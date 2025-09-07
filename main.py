from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import mysql.connector
from datetime import datetime, timedelta
import hashlib
import json
import jwt
import os

# FastAPI app initialization
app = FastAPI(title="Visitor Management System API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure as needed for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
SECRET_KEY = "Master@123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Database Configuration
DB_CONFIG = {
    'host': 'metro.proxy.rlwy.net',
    'user': 'root',
    'password': 'vkSILBLQSwXGfVBCgjdTultaYtUcxVJq',
    'database': 'railway'
}


# Permissions Configuration
PERMISSIONS = {
    'ADMIN': [
        'CREATE_USER', 'VIEW_USERS', 'UNLOCK_USER', 'APPROVE_VISITOR', 'VIEW_ALL_VISITORS', 
        'CHECKOUT_VISITOR', 'VIEW_REPORTS', 'CREATE_VISITOR_ENTRY', 'MANAGE_MASTER_DATA', 'LOCK_USER'
    ],
    'HR': [
        'CREATE_USER', 'VIEW_USERS', 'UNLOCK_USER', 'LOCK_USER', 'UNACTIVE_USER', 
        'APPROVE_VISITOR', 'VIEW_MY_ENTRIES',
    ],
    'SECURITY': [
        'CREATE_VISITOR_ENTRY', 'VIEW_ALL_VISITORS',
        'CHECKOUT_VISITOR', 'VIEW_PENDING_APPROVALS', 'VIEW_REPORTS',
    ],
    'USER': [
        'APPROVE_VISITOR', 'VIEW_MY_ENTRIES'
    ]
}

# Pydantic Models
class UserLogin(BaseModel):
    empid: str
    password: str

class UserCreate(BaseModel):
    empid: str
    empname: str
    emp_mobile_no: int
    password: str
    user_role: str

class FellowVisitor(BaseModel):
    name: str
    mobile: int

class VisitorCreate(BaseModel):
    name: str
    mobile: str
    email: Optional[str] = None
    id_type: str
    id_number: str
    representing: Optional[str] = None
    purpose: str
    emp_mobile_no: int
    visitor_category: str
    fellow_visitors: int = 0
    fellow_visitors_details: Optional[List[FellowVisitor]] = []

class VisitorApproval(BaseModel):
    card_no: str
    action: str  # 'A' for approve, 'R' for reject
    rejection_reason: Optional[str] = None

class UserAction(BaseModel):
    empid: str

class UserActionWithPassword(BaseModel):
    empid: str
    master_password: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user_info: Dict

class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

# Database Class
class VMSDatabase:
    def __init__(self):
        self.config = DB_CONFIG

    def get_connection(self):
        try:
            conn = mysql.connector.connect(**self.config)
            return conn
        except mysql.connector.Error as err:
            raise HTTPException(status_code=500, detail=f"Database connection error: {err}")

# Authentication Functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed_password: str) -> bool:
    return hash_password(password) == hashed_password

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        empid: str = payload.get("sub")
        if empid is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        db = VMSDatabase()
        conn = db.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM users WHERE empid = %s AND status = 'A'", (empid,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def check_permission(user: dict, permission: str) -> bool:
    user_role = user['user_role']
    return permission in PERMISSIONS.get(user_role, [])

def require_permission(permission: str):
    def permission_checker(current_user: dict = Depends(get_current_user)):
        if not check_permission(current_user, permission):
            raise HTTPException(status_code=403, detail="Insufficient privileges")
        return current_user
    return permission_checker

# API Endpoints
@app.post("/api/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM users WHERE empid = %s", (user_login.empid.upper(),))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Employee ID not found")
        
        if user['status'] in ['L', 'I']:
            raise HTTPException(status_code=401, detail="Account locked or inactive")
        
        if not verify_password(user_login.password, user['password_hash']):
            # Default failed_attempts to 0 if it's None
            failed_attempts = user['failed_attempts'] or 0
            # Update failed attempts
            new_attempts = user['failed_attempts'] + 1
            # Update failed_attempts in DB
            cursor.execute("UPDATE users SET failed_attempts = %s WHERE id = %s", 
                   (new_attempts, user['id']))
            if new_attempts >= 5:
                cursor.execute("UPDATE users SET status = 'L' WHERE id = %s", (user['id'],))
            conn.commit()

            if new_attempts >= 5:
                raise HTTPException(status_code=401, detail="Account locked due to failed attempts")
            conn.commit()
            raise HTTPException(status_code=401, detail="Incorrect password")
        
        # Reset failed attempts and update last login
        cursor.execute("UPDATE users SET failed_attempts = 0, last_login = %s WHERE id = %s",
                      (datetime.now(), user['id']))
        conn.commit()
        
        access_token = create_access_token(data={"sub": user['empid']})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_info": {
                "empid": user['empid'],
                "empname": user['empname'],
                "user_role": user['user_role']
            }
        }
    finally:
        cursor.close()
        conn.close()

@app.post("/api/users", response_model=ApiResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_permission('CREATE_USER'))):
    if user_data.user_role not in PERMISSIONS:
        raise HTTPException(status_code=400, detail="Invalid user role")
    
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute("SELECT COUNT(*) FROM users WHERE empid = %s", (user_data.empid.upper(),))
        if cursor.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="Employee ID already exists")
        
        hashed_password = hash_password(user_data.password)
        
        cursor.execute("""
            INSERT INTO users (empid, empname, emp_mobile_no, password_hash, user_role, created_by, created_date)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (user_data.empid.upper(), user_data.empname, user_data.emp_mobile_no, 
              hashed_password, user_data.user_role, current_user['empid']))
        conn.commit()
        
        return ApiResponse(success=True, message="User created successfully")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/users", response_model=ApiResponse)
async def get_users(current_user: dict = Depends(require_permission('VIEW_USERS'))):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT empid, empname, emp_mobile_no, user_role, status, failed_attempts, 
                   last_login, created_by FROM users ORDER BY empname
        """)
        users = cursor.fetchall()
        
        return ApiResponse(success=True, message="Users retrieved successfully", data=users)
    finally:
        cursor.close()
        conn.close()

@app.post("/api/users/lock", response_model=ApiResponse)
async def lock_user(user_action: UserActionWithPassword, current_user: dict = Depends(require_permission('LOCK_USER'))):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT user_role, status FROM users WHERE empid = %s", (user_action.empid.upper(),))
        result = cursor.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Employee ID not found")

        user_role, status = result

        if status == 'L':
            raise HTTPException(status_code=400, detail="Account is already locked")

        # If ADMIN or HR, block unless master password is handled (future)
        if user_role in ['ADMIN', 'HR']:
            if user_action.master_password != "Master@123":
                raise HTTPException(status_code=401, detail="Master password required to lock ADMIN or HR")

        # Proceed to lock
        cursor.execute("""
            UPDATE users 
            SET status = 'L', modify_by = %s, modify_date = NOW()
            WHERE empid = %s
        """, (current_user['empid'], user_action.empid.upper()))
        conn.commit()

        return ApiResponse(success=True, message="User account locked successfully")
    finally:
        cursor.close()
        conn.close()

@app.post("/api/users/unlock", response_model=ApiResponse)
async def unlock_user(user_action: UserActionWithPassword, current_user: dict = Depends(require_permission('UNLOCK_USER'))):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor()

    try:
        # Get the role and status of the target user
        cursor.execute("SELECT user_role, status FROM users WHERE empid = %s", (user_action.empid.upper(),))
        result = cursor.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Employee ID not found")

        user_role, status = result

        if status == 'A':
            raise HTTPException(status_code=400, detail="Account is already active")

        # If the target user is ADMIN or HR, check master password
        if user_role in ['ADMIN', 'HR']:
            if user_action.master_password != "Master@123":
                raise HTTPException(status_code=401, detail="Invalid master password")

        # Proceed to unlock
        cursor.execute("""
            UPDATE users 
            SET status = 'A', failed_attempts = 0, modify_by = %s, modify_date = NOW()
            WHERE empid = %s
        """, (current_user['empid'], user_action.empid.upper()))
        conn.commit()

        return ApiResponse(success=True, message="User account unlocked successfully")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/master-data/{table_name}", response_model=ApiResponse)
async def get_master_data(table_name: str, current_user: dict = Depends(get_current_user)):
    valid_tables = {
        'visitor_category_master': 'category_name',
        'purpose_master': 'purpose_name',
        'id_master': 'id_type_name'
    }
    
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail="Invalid table name")
    
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor()
    
    try:
        column_name = valid_tables[table_name]
        cursor.execute(f"SELECT {column_name} FROM {table_name} WHERE status = 'A' ORDER BY {column_name}")
        results = [row[0] for row in cursor.fetchall()]
        
        return ApiResponse(success=True, message="Master data retrieved successfully", data=results)
    finally:
        cursor.close()
        conn.close()

@app.post("/api/visitors", response_model=ApiResponse)
async def create_visitor_entry(visitor_data: VisitorCreate, current_user: dict = Depends(require_permission('CREATE_VISITOR_ENTRY'))):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor()

    try:
        # Find host employee
        cursor.execute("SELECT empid, empname FROM users WHERE emp_mobile_no = %s AND status = 'A'", 
                      (visitor_data.emp_mobile_no,))
        emp_result = cursor.fetchone()
        
        if not emp_result:
            raise HTTPException(status_code=400, detail="Host employee not found")
        
        emp_id, emp_name = emp_result

        # Generate card number
        today = datetime.now().strftime('%Y-%m-%d')
        cursor.execute("SELECT COUNT(*) FROM vms WHERE DATE(entry_date) = %s", (today,))
        count = cursor.fetchone()[0] + 1
        card_no = f"{datetime.now().strftime('%Y%m%d')}-{count:03d}"

        cursor.execute("""
            INSERT INTO vms (
                card_no, name, mobile, email, id_type, id_number, representing, purpose,
                approve, emp_id, emp_name, emp_mobile_no, fellow_visitors, fellow_visitors_details,
                visitor_category, created_by, created_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            card_no,
            visitor_data.name,
            visitor_data.mobile,
            visitor_data.email,
            visitor_data.id_type,
            visitor_data.id_number,
            visitor_data.representing,
            visitor_data.purpose,
            'P',
            emp_id,
            emp_name,
            visitor_data.emp_mobile_no,
            visitor_data.fellow_visitors or 0,
            json.dumps([f.dict() for f in visitor_data.fellow_visitors_details]) if visitor_data.fellow_visitors_details else None,
            visitor_data.visitor_category,
            current_user['empid']
        ))
        conn.commit()

        return ApiResponse(success=True, message=f"Visitor entry created successfully with Card No: {card_no}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/visitors", response_model=ApiResponse)
async def get_visitor_entries(current_user: dict = Depends(get_current_user)):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        sql_query = """
            SELECT card_no, name, mobile, representing, entry_date, approve, created_by,
                   emp_name, visitor_category, purpose, out_time
            FROM vms
        """
        params = []
        
        if not check_permission(current_user, 'VIEW_ALL_VISITORS'):
            sql_query += " WHERE emp_id = %s"
            params.append(current_user['empid'])
        
        sql_query += " ORDER BY entry_date DESC LIMIT 50"
        
        cursor.execute(sql_query, tuple(params))
        results = cursor.fetchall()
        
        return ApiResponse(success=True, message="Visitor entries retrieved successfully", data=results)
    finally:
        cursor.close()
        conn.close()

@app.get("/api/visitors/pending", response_model=ApiResponse)
async def get_pending_approvals(current_user: dict = Depends(get_current_user)):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        query = """
            SELECT card_no, name, mobile, representing, purpose, emp_name, visitor_category, entry_date
            FROM vms WHERE approve='P'
        """
        params = []
        
        if current_user['user_role'] == 'USER':
            query += " AND emp_id = %s"
            params.append(current_user['empid'])
        
        query += " ORDER BY entry_date DESC LIMIT 20"
        cursor.execute(query, tuple(params))
        results = cursor.fetchall()
        
        return ApiResponse(success=True, message="Pending approvals retrieved successfully", data=results)
    finally:
        cursor.close()
        conn.close()

@app.post("/api/visitors/approve", response_model=ApiResponse)
async def approve_visitor(
    approval_data: VisitorApproval,
    current_user: dict = Depends(require_permission('APPROVE_VISITOR'))
):
    if approval_data.action not in ['A', 'R']:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'A' for approve or 'R' for reject")

    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor()

    try:
        # Check if entry exists and is pending
        cursor.execute("SELECT approve FROM vms WHERE card_no = %s", (approval_data.card_no,))
        result = cursor.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Visitor entry not found")
        if result[0] != 'P':
            raise HTTPException(status_code=400, detail="Entry already processed")

        if approval_data.action == "A":
            cursor.execute("""
                UPDATE vms
                SET approve = %s,
                    approve_dt = NOW(),
                    approved_by = %s,
                    modify_by = %s,
                    modify_date = NOW()
                WHERE card_no = %s
            """, (
                "A",
                current_user['empid'],
                current_user['empid'],
                approval_data.card_no
            ))

        elif approval_data.action == "R":
            cursor.execute("""
                UPDATE vms
                SET approve = %s,
                    approve_dt = NOW(),
                    approved_by = %s,
                    modify_by = %s,
                    modify_date = NOW()
                WHERE card_no = %s
            """, (
                "R",
                current_user['empid'],
                current_user['empid'],
                approval_data.card_no
            ))

        conn.commit()

        action_text = "approved" if approval_data.action == 'A' else "rejected"
        return ApiResponse(success=True, message=f"Visitor entry {action_text} successfully")
    finally:
        cursor.close()
        conn.close()


@app.post("/api/visitors/{card_no}/checkout", response_model=ApiResponse)
async def checkout_visitor(card_no: str, current_user: dict = Depends(require_permission('CHECKOUT_VISITOR'))):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT name FROM vms WHERE card_no = %s AND approve = 'A' AND out_time IS NULL", (card_no,))
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="No active visitor found with that card number")
        
        cursor.execute("""
            UPDATE vms SET out_time = %s, modify_by = %s, modify_date = %s
            WHERE card_no = %s
        """, (datetime.now(), current_user['empid'], datetime.now(), card_no))
        conn.commit()
        
        return ApiResponse(success=True, message=f"Visitor {result[0]} checked out successfully")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/visitors/active", response_model=ApiResponse)
async def get_active_visitors(current_user: dict = Depends(require_permission('CHECKOUT_VISITOR'))):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT card_no, name, mobile, approve_dt
            FROM vms WHERE approve='A' AND out_time IS NULL ORDER BY approve_dt DESC LIMIT 20
        """)
        results = cursor.fetchall()
        
        return ApiResponse(success=True, message="Active visitors retrieved successfully", data=results)
    finally:
        cursor.close()
        conn.close()

@app.get("/api/reports/{report_type}", response_model=ApiResponse)
async def get_reports(report_type: str, date: Optional[str] = None, current_user: dict = Depends(require_permission('VIEW_REPORTS'))):
    db = VMSDatabase()
    conn = db.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        if report_type == "daily":
            report_date = date or datetime.now().strftime('%Y-%m-%d')
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN approve='A' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN approve='P' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN approve='R' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN out_time IS NOT NULL THEN 1 ELSE 0 END) as checked_out
                FROM vms WHERE DATE(entry_date) = %s
            """, (report_date,))
            result = cursor.fetchone()
            
            return ApiResponse(success=True, message="Daily report generated", data={
                "report_date": report_date,
                "summary": result
            })
        
        elif report_type == "summary":
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN approve='A' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN approve='P' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN approve='R' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN approve='A' AND out_time IS NULL THEN 1 ELSE 0 END) as currently_inside,
                    SUM(CASE WHEN approve='A' AND out_time IS NOT NULL THEN 1 ELSE 0 END) as checked_out
                FROM vms WHERE entry_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            """)
            result = cursor.fetchone()
            
            return ApiResponse(success=True, message="30-day summary generated", data=result)
        
        elif report_type == "frequent":
            cursor.execute("""
                SELECT name, mobile, COUNT(*) as visit_count
                FROM vms
                WHERE entry_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                GROUP BY mobile, name
                HAVING visit_count > 1
                ORDER BY visit_count DESC LIMIT 10
            """)
            results = cursor.fetchall()
            
            return ApiResponse(success=True, message="Frequent visitors report generated", data=results or [])

        
        else:
            raise HTTPException(status_code=400, detail="Invalid report type")
    
    finally:
        cursor.close()
        conn.close()

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)