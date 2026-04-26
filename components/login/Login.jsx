'use client'

import { useRef, useState, useContext } from "react";
import { useRouter } from "next/navigation";
import UserContext from "@/context/UserContext";
import { authenticatedPost } from "@/utils/apiClient";

function Login() {
  const router = useRouter();
  const { setUser } = useContext(UserContext);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [errorsData, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    const formData = {
      email: emailRef.current.value,
      password: passwordRef.current.value,
    };

    try {
      const response = await authenticatedPost("/api/auth/login", formData);

      if (response.data.user) {
        const u = response.data.user;
        if (setUser) setUser(u);
      }

      router.push("/dashboard");
    } catch (error) {

      if (error.data) {
        const errorData = error.data;
        if (errorData.error) {
          if (errorData.error.details) {
            setErrors({ ...errorData.error.details });
          } else {
            setErrors({ general: errorData.error.message || "Login failed" });
          }
        } else {
          setErrors({ general: "Login failed" });
        }
      } else {
        setErrors({ general: "Network error. Please check your connection and try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            ref={emailRef}
            required
          />
          {errorsData.email && <p className="error">{errorsData.email}</p>}
        </div>
        <div>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            ref={passwordRef}
            required
          />
          {errorsData.password && <p className="error">{errorsData.password}</p>}
        </div>
        {errorsData.general && <p className="error">{errorsData.general}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default Login;
