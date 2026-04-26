'use client'

import { useRef, useState, useContext } from "react";
import { useRouter } from "next/navigation";
import UserContext from "@/context/UserContext";
import { authenticatedPost } from "@/utils/apiClient";

function Signup() {
  const router = useRouter();
  const { setUser } = useContext(UserContext);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [errorsData, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    const formData = {
      firstName: firstNameRef.current.value,
      lastName: lastNameRef.current.value,
      email: emailRef.current.value,
      password: passwordRef.current.value,
    };

    try {
      const response = await authenticatedPost("/api/auth/register", formData);

      if (response.data.user) {
        const u = response.data.user;
        if (setUser) setUser(u);
      }

      router.push("/dashboard");
    } catch (error) {

      if (error.data) {
        const errorData = error.data;
        if (errorData.error) {
          const details = errorData.error.details;
          const hasFieldErrors = details && Object.values(details).some((v) => v);
          if (hasFieldErrors) {
            setErrors({ ...details });
          } else {
            setErrors({ general: errorData.error.message || "Signup failed" });
          }
        } else {
          setErrors({ general: "Signup failed" });
        }
      } else {
        setErrors({ general: "Network error. Please check your connection and try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-container">
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="signup-firstname">First Name</label>
          <input id="signup-firstname" type="text" ref={firstNameRef} required />
          {errorsData.firstName && <p className="error">{errorsData.firstName}</p>}
        </div>
        <div>
          <label htmlFor="signup-lastname">Last Name</label>
          <input id="signup-lastname" type="text" ref={lastNameRef} required />
          {errorsData.lastName && <p className="error">{errorsData.lastName}</p>}
        </div>
        <div>
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" ref={emailRef} required />
          {errorsData.email && <p className="error">{errorsData.email}</p>}
        </div>
        <div>
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" ref={passwordRef} required minLength={8} />
          {errorsData.password && <p className="error">{errorsData.password}</p>}
        </div>
        {errorsData.general && <p className="error">{errorsData.general}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}

export default Signup;
