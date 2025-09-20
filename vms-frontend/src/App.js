import React, { useState, useEffect, useCallback } from "react";
import logo1 from "./assets/logo1.png";

// --- Helper Functions & Constants ---
const API_BASE_URL = "process.env.REACT_APP_API_URL;"; // Replaced with actual backend URL

const PERMISSIONS = {
  ADMIN: [
    "CREATE_USER",
    "VIEW_USERS",
    "UNLOCK_USER",
    "APPROVE_VISITOR",
    "VIEW_ALL_VISITORS",
    "CHECKOUT_VISITOR",
    "VIEW_REPORTS",
    "CREATE_VISITOR_ENTRY",
    "MANAGE_MASTER_DATA",
    "LOCK_USER",
  ],
  HR: [
    "CREATE_USER",
    "VIEW_USERS",
    "UNLOCK_USER",
    "LOCK_USER",
    "UNACTIVE_USER",
    "APPROVE_VISITOR",
    "VIEW_MY_ENTRIES",
  ],
  SECURITY: [
    "CREATE_VISITOR_ENTRY",
    "VIEW_ALL_VISITORS",
    "CHECKOUT_VISITOR",
    "VIEW_PENDING_APPROVALS",
    "VIEW_REPORTS",
  ],
  USER: ["APPROVE_VISITOR", "VIEW_MY_ENTRIES"],
};

// --- API Helper ---
const apiRequest = async (
  endpoint,
  method = "GET",
  body = null,
  token = null
) => {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (token) {
    options.headers["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ detail: "An unknown error occurred." }));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`
      );
    }
    // For login which returns a token directly
    if (
      endpoint.includes("login") &&
      response.headers.get("content-type")?.includes("application/json")
    ) {
      return response.json();
    }
    // For other successful responses
    return response.json();
  } catch (error) {
    console.error(`API request failed: ${method} ${endpoint}`, error);
    throw error;
  }
};

// --- UI Components ---

const Modal = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-full overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const Spinner = () => (
  <div className="flex justify-center items-center h-full">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
  </div>
);

const Alert = ({ message, type = "error", onClose }) => {
  if (!message) return null;
  const baseClasses =
    "p-4 rounded-lg flex items-center justify-between shadow-md mb-4";
  const typeClasses = {
    error: "bg-red-100 border border-red-400 text-red-700",
    success: "bg-green-100 border border-green-400 text-green-700",
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-lg font-semibold">
        &times;
      </button>
    </div>
  );
};

// --- Form Input Components with Validation ---

const ValidatedInput = ({
  id,
  label,
  type,
  value,
  onChange,
  error,
  pattern,
  title,
  required = true,
}) => (
  <div className="mb-4">
    <label
      htmlFor={id}
      className="block text-sm font-medium text-gray-700 mb-1"
    >
      {label}
    </label>
    <input
      id={id}
      name={id}
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      pattern={pattern}
      title={title}
      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${
        error
          ? "border-red-500 focus:ring-red-500"
          : "border-gray-300 focus:ring-blue-500"
      }`}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

// --- Helps in locking user ---

const LockUserModal = ({ show, onClose, onConfirm, targetUser }) => {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!masterPassword) {
      setError("Please enter the master password.");
      return;
    }
    onConfirm(masterPassword);
    setMasterPassword("");
    setError("");
  };

  if (!show) return null;

  return (
    <Modal show={true} onClose={onClose} title={`Lock ${targetUser.empid}`}>
      <p className="mb-4">
        This user has elevated privileges. Enter the master password to
        continue.
      </p>
      <input
        type="password"
        value={masterPassword}
        onChange={(e) => setMasterPassword(e.target.value)}
        placeholder="Master password"
        className="w-full px-3 py-2 border rounded-md mb-2"
      />
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="bg-gray-200 px-4 py-2 rounded-md"
          class="btn btn-blue"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          class="btn btn-red"
        >
          Confirm Lock
        </button>
      </div>
    </Modal>
  );
};

// --- Helps in Unlocking User ---

const UnlockUserModal = ({ show, onClose, onConfirm, targetUser }) => {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!masterPassword) {
      setError("Please enter the master password.");
      return;
    }
    onConfirm(masterPassword);
    setMasterPassword("");
    setError("");
  };

  if (!show) return null;

  return (
    <Modal show={true} onClose={onClose} title={`Unlock ${targetUser.empid}`}>
      <p className="mb-4">
        This user is an ADMIN or HR. Please enter the master password.
      </p>
      <input
        type="password"
        value={masterPassword}
        onChange={(e) => setMasterPassword(e.target.value)}
        placeholder="Master password"
        className="w-full px-3 py-2 border rounded-md mb-2"
      />
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-md">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          class="btn btn-blue"
        >
          Confirm Unlock
        </button>
      </div>
    </Modal>
  );
};

// --- Core Feature Components ---

const Login = ({ setAuth }) => {
  const [empid, setEmpid] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/api/auth/login", "POST", {
        empid,
        password,
      });
      setAuth({ token: data.access_token, user: data.user_info });
      localStorage.setItem("vms_token", data.access_token);
      localStorage.setItem("vms_user", JSON.stringify(data.user_info));
    } catch (err) {
      setError(err.message);
      setFailedAttempts((prev) => prev + 1);
      setAttemptsLeft((prev) => prev - 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Visitor Management System
        </h2>
        <Alert message={error} onClose={() => setError("")} />
        {error && (
          <div className="text-red-600 text-sm mt-2 text-center">
            {failedAttempts >= 2 && attemptsLeft > 0 && (
              <p>
                You have {attemptsLeft} attempt{attemptsLeft !== 1 && "s"} left.
              </p>
            )}
            {attemptsLeft <= 0 && (
              <p className="font-semibold">
                Too many failed attempts. Login is temporarily disabled.
              </p>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <ValidatedInput
            id="empid"
            label="Employee ID"
            type="text"
            value={empid}
            onChange={(e) => setEmpid(e.target.value.toUpperCase())}
          />
          <ValidatedInput
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

const CreateUser = ({ auth, onUserCreated }) => {
  const [formData, setFormData] = useState({
    empid: "",
    empname: "",
    emp_mobile_no: "",
    password: "",
    user_role: "USER",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Basic validation
    if (!/^\d{10}$/.test(formData.emp_mobile_no)) {
      setError("Mobile number must be 10 digits.");
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest(
        "/api/users",
        "POST",
        formData,
        auth.token
      );
      setSuccess(response.message);
      setFormData({
        empid: "",
        empname: "",
        emp_mobile_no: "",
        password: "",
        user_role: "USER",
      });
      if (onUserCreated) onUserCreated();
    } catch (err) {
      if (err.message.includes("Mobile number already exists")) {
        setError("This mobile number is already registered.");
      } else if (err.message.includes("Employee ID already exists")) {
        setError("This employee ID is already registered.");
      } else {
        setError("Failed to create user. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Create New User</h3>
      <Alert message={error} type="error" onClose={() => setError("")} />
      <Alert message={success} type="success" onClose={() => setSuccess("")} />
      <form onSubmit={handleSubmit}>
        <ValidatedInput
          id="empid"
          label="Employee ID"
          type="text"
          value={formData.empid}
          onChange={handleChange}
        />
        <ValidatedInput
          id="empname"
          label="Employee Name"
          type="text"
          value={formData.empname}
          onChange={handleChange}
          pattern="^[^\d][\w\s]*$"
          title="Name should not start with a number"
        />
        <ValidatedInput
          id="emp_mobile_no"
          label="Mobile Number"
          type="tel"
          value={formData.emp_mobile_no}
          onChange={handleChange}
          pattern="\d{10}"
          title="Enter a 10-digit mobile number."
        />
        <ValidatedInput
          id="password"
          label="Password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          title="Minimum 6 characters."
        />
        <div className="mb-4">
          <label
            htmlFor="user_role"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            User Role
          </label>
          <select
            id="user_role"
            name="user_role"
            value={formData.user_role}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="USER">USER</option>
            <option value="SECURITY">SECURITY</option>
            <option value="HR">HR</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-green-300"
        >
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>
    </div>
  );
};

const ViewUsers = ({ auth }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/api/users", "GET", null, auth.token);
      setUsers(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (endpoint, empid, masterPassword = null) => {
    setActionError("");
    setActionSuccess("");
    try {
      const payload = { empid };
      if (masterPassword) {
        payload.master_password = masterPassword;
      }
      const response = await apiRequest(endpoint, "POST", payload, auth.token);
      setActionSuccess(response.message);
      fetchUsers(); // Refresh the list
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert message={error} />;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Manage Users</h3>
      <Alert
        message={actionError}
        type="error"
        onClose={() => setActionError("")}
      />
      <Alert
        message={actionSuccess}
        type="success"
        onClose={() => setActionSuccess("")}
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Emp ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.empid}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.empid}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.empname}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.user_role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.status === "A"
                        ? "bg-green-100 text-green-800"
                        : user.status === "L"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {user.status === "A"
                      ? "Active"
                      : user.status === "L"
                      ? "Locked"
                      : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.status === "L" &&
                    checkPermission(auth.user, "UNLOCK_USER") && (
                      <button
                        onClick={() => {
                          if (["ADMIN", "HR"].includes(user.user_role)) {
                            setSelectedUser(user);
                            setShowUnlockModal(true);
                          } else {
                            if (
                              window.confirm(
                                "Are you sure you want to lock this user?"
                              )
                            ) {
                              handleAction("/api/users/unlock", user.empid);
                            }
                          }
                        }}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                        class="btn btn-blue"
                      >
                        Unlock
                      </button>
                    )}
                  {user.status === "A" &&
                    checkPermission(auth.user, "LOCK_USER") && (
                      <button
                        onClick={() => {
                          if (["ADMIN", "HR"].includes(user.user_role)) {
                            setSelectedUser(user);
                            setShowLockModal(true);
                          } else {
                            if (
                              window.confirm(
                                "Are you sure you want to lock this user?"
                              )
                            ) {
                              handleAction("/api/users/lock", user.empid);
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-900"
                        class="btn btn-red"
                      >
                        Lock
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LockUserModal
        show={showLockModal}
        onClose={() => setShowLockModal(false)}
        targetUser={selectedUser}
        onConfirm={(masterPassword) => {
          handleAction("/api/users/lock", selectedUser.empid, masterPassword);
          setShowLockModal(false);
        }}
      />

      <UnlockUserModal
        show={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        targetUser={selectedUser}
        onConfirm={(masterPassword) => {
          handleAction("/api/users/unlock", selectedUser.empid, masterPassword);
          setShowUnlockModal(false);
        }}
      />
    </div>
  );
};

const CreateVisitorEntry = ({ auth, onVisitorCreated }) => {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    id_type: "",
    id_number: "",
    representing: "",
    purpose: "",
    emp_mobile_no: "",
    visitor_category: "",
    fellow_visitors: 0,
    fellow_visitors_details: [],
  });
  const [masterData, setMasterData] = useState({
    categories: [],
    purposes: [],
    idTypes: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostFound, setHostFound] = useState(null);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [catRes, purpRes, idRes] = await Promise.all([
          apiRequest(
            "/api/master-data/visitor_category_master",
            "GET",
            null,
            auth.token
          ),
          apiRequest(
            "/api/master-data/purpose_master",
            "GET",
            null,
            auth.token
          ),
          apiRequest("/api/master-data/id_master", "GET", null, auth.token),
        ]);
        setMasterData({
          categories: catRes.data || [],
          purposes: purpRes.data || [],
          idTypes: idRes.data || [],
        });
        // Set default values
        if (catRes.data.length > 0)
          setFormData((f) => ({ ...f, visitor_category: catRes.data[0] }));
        if (purpRes.data.length > 0)
          setFormData((f) => ({ ...f, purpose: purpRes.data[0] }));
        if (idRes.data.length > 0)
          setFormData((f) => ({ ...f, id_type: idRes.data[0] }));
      } catch (err) {
        setError("Failed to load master data. Please try again.");
      }
    };
    fetchMasterData();
  }, [auth.token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const lookupHost = async (number) => {
    if (!number || number.length !== 10) {
      setHostFound(null);
      setHostName("");
      return;
    }

    try {
      const res = await apiRequest(
        `/api/users/host_lookup?number=${number}`,
        "GET",
        null,
        auth.token
      );
      if (res.found) {
        setHostFound(true);
        setHostName(res.empname);
      } else {
        setHostFound(false);
        setHostName("");
      }
    } catch (err) {
      setHostFound(false);
      setHostName("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!/^\d{10}$/.test(formData.mobile)) {
      setError("Visitor's mobile number must be 10 digits.");
      setLoading(false);
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Invalid email format.");
      setLoading(false);
      return;
    }
    if (!/^\d{10}$/.test(formData.emp_mobile_no)) {
      setError("Host employee's mobile number must be 10 digits.");
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest(
        "/api/visitors",
        "POST",
        formData,
        auth.token
      );
      setSuccess(response.message);
      // Reset form
      setFormData({
        name: "",
        mobile: "",
        email: "",
        id_type: masterData.idTypes[0] || "",
        id_number: "",
        representing: "",
        purpose: masterData.purposes[0] || "",
        emp_mobile_no: "",
        visitor_category: masterData.categories[0] || "",
        fellow_visitors: 0,
        fellow_visitors_details: [],
      });
      if (onVisitorCreated) onVisitorCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">New Visitor Entry</h3>
      <Alert message={error} type="error" onClose={() => setError("")} />
      <Alert message={success} type="success" onClose={() => setSuccess("")} />
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="md:col-span-1">
          <ValidatedInput
            id="emp_mobile_no"
            label="Host Employee Mobile"
            type="tel"
            value={formData.emp_mobile_no}
            onChange={(e) => {
              handleChange(e);
              lookupHost(e.target.value);
            }}
            pattern="\d{10}"
            title="10-digit mobile number"
          />
          {hostFound === true && (
            <p className="text-green-600 text-base font-medium mt-1">
              Host found: {hostName}
            </p>
          )}
          {hostFound === false && (
            <p className="text-red-600 text-base font-medium mt-1">
              Host not found
            </p>
          )}
        </div>
        <ValidatedInput
          id="name"
          label="Visitor Name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          pattern="^[^\d][\w\s]*$"
          title="Name should not start with a number"
        />
        <ValidatedInput
          id="mobile"
          label="Visitor Mobile"
          type="tel"
          value={formData.mobile}
          onChange={handleChange}
          pattern="\d{10}"
          title="10-digit mobile number"
        />
        <ValidatedInput
          id="email"
          label="Visitor Email (Optional)"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required={false}
          title="e.g., user@example.com"
        />
        <ValidatedInput
          id="representing"
          label="Representing (Optional)"
          type="text"
          value={formData.representing}
          onChange={handleChange}
          required={false}
        />

        <div>
          <label
            htmlFor="id_type"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            ID Type
          </label>
          <select
            id="id_type"
            name="id_type"
            value={formData.id_type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          >
            {masterData.idTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <ValidatedInput
          id="id_number"
          label="ID Number"
          type="text"
          value={formData.id_number}
          onChange={handleChange}
        />

        <div>
          <label
            htmlFor="purpose"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Purpose of Visit
          </label>
          <select
            id="purpose"
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          >
            {masterData.purposes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="visitor_category"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Visitor Category
          </label>
          <select
            id="visitor_category"
            name="visitor_category"
            value={formData.visitor_category}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          >
            {masterData.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <ValidatedInput
          id="fellow_visitors"
          label="Fellow Visitors (Optional)"
          type="number"
          value={formData.fellow_visitors}
          onChange={(e) => {
            const value = Math.max(0, parseInt(e.target.value) || 0);
            setFormData({
              ...formData,
              fellow_visitors: value,
              // Reset or trim details array based on new count
              fellow_visitors_details: formData.fellow_visitors_details.slice(
                0,
                value
              ),
            });
          }}
          required={false}
        />

        {Array.from({ length: Number(formData.fellow_visitors) || 0 }).map(
          (_, index) => (
            <div
              key={index}
              className="md:col-span-2 p-4 border rounded-md bg-gray-50 mb-2"
            >
              <h4 className="font-semibold mb-2">Fellow Visitor {index + 1}</h4>
              <ValidatedInput
                id={`fellow_name_${index}`}
                label="Name"
                type="text"
                value={formData.fellow_visitors_details[index]?.name || ""}
                onChange={(e) => {
                  const updated = [...formData.fellow_visitors_details];
                  updated[index] = {
                    ...updated[index],
                    name: e.target.value,
                  };
                  setFormData({
                    ...formData,
                    fellow_visitors_details: updated,
                  });
                }}
                pattern="^[^\d][\w\s]*$"
                title="Name should not start with a number"
              />
              <ValidatedInput
                id={`fellow_mobile_${index}`}
                label="Mobile"
                type="tel"
                pattern="\d{10}"
                title="10-digit mobile number"
                value={formData.fellow_visitors_details[index]?.mobile || ""}
                onChange={(e) => {
                  const updated = [...formData.fellow_visitors_details];
                  updated[index] = {
                    ...updated[index],
                    mobile: e.target.value,
                  };
                  setFormData({
                    ...formData,
                    fellow_visitors_details: updated,
                  });
                }}
              />
            </div>
          )
        )}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "Submitting..." : "Create Entry"}
          </button>
        </div>
      </form>
    </div>
  );
};

const ViewVisitors = ({ auth }) => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = checkPermission(auth.user, "VIEW_ALL_VISITORS")
        ? "/api/visitors"
        : "/api/visitors"; // API handles filtering
      const response = await apiRequest(endpoint, "GET", null, auth.token);
      setVisitors(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token, auth.user]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  if (loading) return <Spinner />;
  if (error) return <Alert message={error} />;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Visitor Entries</h3>
      <div className="flex justify-end mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
        >
          <option value="all">All</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="pending">pending</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
          placeholder="From Date"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
          placeholder="To Date"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th>Card No</th>
              <th>Visitor Name</th>
              <th>Host Name</th>
              <th>Status</th>
              <th>Entry Time</th>
              <th>Exit Time</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visitors
              .filter((v) => {
                const entryDate = new Date(v.entry_date);
                const from = fromDate ? new Date(fromDate) : null;
                const to = toDate ? new Date(toDate) : null;

                if (from && entryDate < from) return false;
                if (to && entryDate > to) return false;

                if (filter === "approved") return v.approve === "A";
                if (filter === "rejected") return v.approve === "R";
                if (filter === "pending") return v.approve === "P";
                return true; // "all"
              })
              .map((v) => (
                <tr key={v.card_no}>
                  <td className="px-6 py-4">{v.card_no}</td>
                  <td className="px-6 py-4">{v.name}</td>
                  <td className="px-6 py-4">{v.emp_name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        v.approve === "A"
                          ? "bg-green-100 text-green-800"
                          : v.approve === "P"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {v.approve === "A"
                        ? "Approved"
                        : v.approve === "P"
                        ? "Pending"
                        : "Rejected"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {new Date(v.entry_date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {v.approve === "R"
                      ? "Rejected"
                      : v.approve === "P"
                      ? "Pending"
                      : v.out_time
                      ? new Date(v.out_time).toLocaleString()
                      : "Inside"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ApproveVisitor = ({ auth, onApproved }) => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest(
        "/api/visitors/pending",
        "GET",
        null,
        auth.token
      );
      setPending(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (card_no, action) => {
    setActionError("");
    setActionSuccess("");
    if (action === "R" && rejectionReason > 300) {
      setActionError("Rejection reason is too long.");
      return;
    }
    try {
      const payload = {
        card_no,
        action,
        rejection_reason: action === "R" ? rejectionReason : null,
      };
      const response = await apiRequest(
        "/api/visitors/approve",
        "POST",
        payload,
        auth.token
      );
      setActionSuccess(response.message);
      fetchPending();
      setSelectedVisitor(null);
      setRejectionReason("");
      if (onApproved) onApproved();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert message={error} />;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Pending Visitor Approvals</h3>
      <Alert
        message={actionError}
        type="error"
        onClose={() => setActionError("")}
      />
      <Alert
        message={actionSuccess}
        type="success"
        onClose={() => setActionSuccess("")}
      />
      <div className="space-y-4">
        {pending.length === 0 && (
          <p className="text-gray-500">No pending approvals.</p>
        )}
        {pending.map((v) => (
          <div
            key={v.card_no}
            className="p-4 border rounded-lg flex justify-between items-center"
          >
            <div>
              <p className="font-bold">
                {v.name}{" "}
                <span className="font-normal text-gray-600">
                  ({v.representing})
                </span>
              </p>
              <p className="text-sm text-gray-500">
                Purpose: {v.purpose} | Host: {v.emp_name}
              </p>
            </div>
            {auth.user.user_role !== "SECURITY" && (
              <div>
                <button
                  onClick={() => handleAction(v.card_no, "A")}
                  className="bg-green-500 text-white px-3 py-1 rounded-md mr-2 hover:bg-green-600"
                  class="btn btn-green"
                >
                  Approve
                </button>
                <button
                  onClick={() => setSelectedVisitor(v)}
                  className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
                  class="btn btn-red"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Modal
        show={!!selectedVisitor}
        onClose={() => setSelectedVisitor(null)}
        title="Reject Visitor"
      >
        {selectedVisitor && (
          <div>
            <p className="mb-4">
              Please provide a reason for rejecting{" "}
              <strong>{selectedVisitor.name}</strong>.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2 border rounded-md"
              rows="3"
              placeholder="Rejection reason (Optional)..."
            ></textarea>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedVisitor(null)}
                className="px-4 py-2 bg-gray-200 rounded-md"
                class="btn btn-red"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(selectedVisitor.card_no, "R")}
                className="px-4 py-2 bg-red-600 text-white rounded-md"
                class="btn btn-red"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const CheckoutVisitor = ({ auth, onCheckout }) => {
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const fetchActiveVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest(
        "/api/visitors/active",
        "GET",
        null,
        auth.token
      );
      setActiveVisitors(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    fetchActiveVisitors();
  }, [fetchActiveVisitors]);

  const handleCheckout = async (card_no) => {
    setActionError("");
    setActionSuccess("");
    try {
      const response = await apiRequest(
        `/api/visitors/${card_no}/checkout`,
        "POST",
        null,
        auth.token
      );
      setActionSuccess(response.message);
      fetchActiveVisitors();
      if (onCheckout) onCheckout();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert message={error} />;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">
        Active Visitors (Inside Premises)
      </h3>
      <Alert
        message={actionError}
        type="error"
        onClose={() => setActionError("")}
      />
      <Alert
        message={actionSuccess}
        type="success"
        onClose={() => setActionSuccess("")}
      />
      <div className="space-y-3">
        {activeVisitors.length === 0 && (
          <p className="text-gray-500">No visitors currently inside.</p>
        )}
        {activeVisitors.map((v) => (
          <div
            key={v.card_no}
            className="p-4 border rounded-lg flex justify-between items-center"
          >
            <div>
              <p className="font-bold">
                {v.name}{" "}
                <span className="font-normal text-gray-600">
                  (Card: {v.card_no})
                </span>
              </p>
              <p className="text-sm text-gray-500">
                Approved at: {new Date(v.approve_dt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => handleCheckout(v.card_no)}
              className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
              class="btn btn-red"
            >
              Checkout
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ViewReports = ({ auth }) => {
  const [reportType, setReportType] = useState("daily");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    setReportData(null);
    try {
      let endpoint = `/api/reports/${reportType}`;
      if (reportType === "daily" && date) {
        endpoint += `?date=${date}`;
      }
      const response = await apiRequest(endpoint, "GET", null, auth.token);
      setReportData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const renderReport = () => {
    if (!reportData) {
      return (
        <p className="text-gray-500">
          No report data loaded. Please generate a report.
        </p>
      );
    }

    if (reportType === "daily") {
      const summary = reportData.summary || {};

      return (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-semibold text-lg">
            Daily Report for {reportData.report_date || "N/A"}
          </h4>
          <ul className="list-disc list-inside mt-2">
            <li>Total Entries: {summary.total || 0}</li>
            <li>Approved: {summary.approved || 0}</li>
            <li>Pending: {summary.pending || 0}</li>
            <li>Rejected: {summary.rejected || 0}</li>
            <li>Checked Out: {summary.checked_out || 0}</li>
          </ul>
        </div>
      );
    }

    if (reportType === "summary") {
      return (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-semibold text-lg">30-Day Summary</h4>
          <ul className="list-disc list-inside mt-2">
            <li>Total Entries: {reportData.total || 0}</li>
            <li>Approved: {reportData.approved || 0}</li>
            <li>Pending: {reportData.pending || 0}</li>
            <li>Rejected: {reportData.rejected || 0}</li>
            <li>Currently Inside: {reportData.currently_inside || 0}</li>
            <li>Checked Out: {reportData.checked_out || 0}</li>
          </ul>
        </div>
      );
    }

    if (reportType === "frequent") {
      const hasData = Array.isArray(reportData) && reportData.length > 0;

      return (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-semibold text-lg mb-2">
            Frequent Visitors (Last 90 Days)
          </h4>
          {hasData ? (
            <table className="min-w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((v, i) => (
                  <tr key={i}>
                    <td>{v.name}</td>
                    <td>{v.mobile}</td>
                    <td>{v.visit_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-gray-500 py-4">
              No frequent visitors found.
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Reports</h3>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="daily">Daily Report</option>
          <option value="summary">30-Day Summary</option>
          <option value="frequent">Frequent Visitors</option>
        </select>
        {reportType === "daily" && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2 border rounded-md"
          />
        )}
        <button
          onClick={fetchReport}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 min-w-[160px]"
        >
          Generate Report
        </button>
      </div>
      {loading && <Spinner />}
      {error && <Alert message={error} />}
      {reportData && renderReport()}
    </div>
  );
};

// --- Dashboard & Main App ---
const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

const checkPermission = (user, permission) => {
  if (!user || !user.user_role) return false;
  return PERMISSIONS[user.user_role]?.includes(permission);
};

const Dashboard = ({ auth, setAuth }) => {
  const [activeView, setActiveView] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        alert("You've been logged out due to inactivity.");
        localStorage.removeItem("vms_token");
        localStorage.removeItem("vms_user");
        setAuth({ token: null, user: null });
      }, INACTIVITY_LIMIT);
    };

    // 🧠 If user is reloading, we'll detect it via this flag
    const markReload = () => {
      sessionStorage.setItem("reloading", "true");
    };

    const handleUnload = () => {
      const isReloading = sessionStorage.getItem("reloading");
      sessionStorage.removeItem("reloading");

      if (!isReloading) {
        // Tab closed or browser closed
        localStorage.removeItem("vms_token");
        localStorage.removeItem("vms_user");
      }
    };

    // 👂 Track activity
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    window.addEventListener("beforeunload", markReload);
    window.addEventListener("unload", handleUnload);

    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      clearTimeout(timeout);
      window.removeEventListener("beforeunload", markReload);
      window.removeEventListener("unload", handleUnload);
    };
  }, [setAuth]);

  // Used to force re-render of components
  const userPermissions = PERMISSIONS[auth.user.user_role] || [];
  useEffect(() => {
    setActiveView(""); // Don't auto-load any view
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("vms_token");
    localStorage.removeItem("vms_user");
    setAuth({ token: null, user: null });
  };

  const handleActionComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const renderView = () => {
    switch (activeView) {
      case "CREATE_USER":
        return <CreateUser auth={auth} onUserCreated={handleActionComplete} />;
      case "VIEW_USERS":
        return <ViewUsers auth={auth} key={refreshKey} />;
      case "CREATE_VISITOR_ENTRY":
        return (
          <CreateVisitorEntry
            auth={auth}
            onVisitorCreated={handleActionComplete}
          />
        );
      case "VIEW_ALL_VISITORS":
      case "VIEW_MY_ENTRIES":
        return <ViewVisitors auth={auth} key={refreshKey} />;
      case "APPROVE_VISITOR":
      case "VIEW_PENDING_APPROVALS":
        return <ApproveVisitor auth={auth} onApproved={handleActionComplete} />;
      case "CHECKOUT_VISITOR":
        return (
          <CheckoutVisitor auth={auth} onCheckout={handleActionComplete} />
        );
      case "VIEW_REPORTS":
        return <ViewReports auth={auth} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <h2 className="text-3xl font-bold mb-2">
              Welcome, {auth.user.empname}!
            </h2>
            <p className="text-lg text-gray-600 mb-4">
              Select an option from the Sidebar to get started.
            </p>
            <img
              src="/im.jpg"
              alt="Welcome"
              className="w-10px object-contain mt-3 rounded-lg shadow-md transform scale-50"
            />
          </div>
        );
    }
  };

  const getButtonLabel = (perm) => {
    const labels = {
      CREATE_USER: "Create User",
      VIEW_USERS: "View Users",
      CREATE_VISITOR_ENTRY: "New Visitor",
      VIEW_ALL_VISITORS: "All Visitors",
      VIEW_MY_ENTRIES: "My Visitors",
      APPROVE_VISITOR: "Approve Visitors",
      VIEW_PENDING_APPROVALS: "Pending Approvals",
      CHECKOUT_VISITOR: "Checkout Visitor",
      VIEW_REPORTS: "View Reports",
      LOCK_USER: "Lock User", // Handled inside ViewUsers
      UNLOCK_USER: "Unlock User", // Handled inside ViewUsers
    };
    return labels[perm];
  };

  // Filter out permissions that are actions within another component
  const sidebarPermissions = userPermissions.filter(
    (p) =>
      ![
        "LOCK_USER",
        "UNLOCK_USER",
        "UNACTIVE_USER",
        "MANAGE_MASTER_DATA",
      ].includes(p)
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col fixed top-0 left-0 h-full z-40">
        {/* Logo and VMS */}
        <div className="p-4 flex flex-col items-center border-b border-gray-700">
          <img
            src={logo1}
            alt="Logo"
            className="w-full h-auto object-contain"
            style={{ borderRadius: "0px" }}
          />
          <h2 className="text-2xl font-bold tracking-widest mt-2">V M S</h2>
        </div>

        {/* User Info */}
        <div className="mt-2 px-3 text-center text-xs leading-snug">
          <p className="font-semibold">
            Logged in as:
            <br />
            <span className="text-sm font-bold">
              {auth.user.empname} ({auth.user.empid})
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Role: {auth.user.user_role}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-4 px-2 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveView("")}
            className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === "" ? "bg-gray-900" : "hover:bg-gray-700"
            }`}
          >
            Dashboard
          </button>
          {sidebarPermissions.map((perm) => {
            const label = getButtonLabel(perm);
            if (!label) return null;
            return (
              <button
                key={perm}
                onClick={() => setActiveView(perm)}
                className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === perm ? "bg-gray-900" : "hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <p className="text-sm">
            {/* Logged in as <strong>{auth.user.empname}</strong> */}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto ml-64">
        {renderView()}
      </main>

      <button
        onClick={handleLogout}
        class="logout-btn"
        // className="w-full mt-2 bg-red-600 text-white py-2 rounded-md hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
};

function App() {
  const [auth, setAuth] = useState({ token: null, user: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("vms_token");
    const user = localStorage.getItem("vms_user");
    if (token && user) {
      try {
        setAuth({ token, user: JSON.parse(user) });
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <Spinner />;
  }

  if (!auth.token || !auth.user) {
    return <Login setAuth={setAuth} />;
  }

  return <Dashboard auth={auth} setAuth={setAuth} />;
}
export default App;
