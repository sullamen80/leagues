import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../firebase';

const CompletePasswordReset = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [oobCode, setOobCode] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  // Extract the reset code from URL on component mount
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const code = queryParams.get('oobCode');
    
    if (!code) {
      setError('Invalid password reset link. Please try again.');
      setVerifying(false);
      return;
    }
    
    setOobCode(code);
    
    // Verify the action code
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        setEmail(email);
        setVerifying(false);
      })
      .catch((error) => {
        console.error('Error verifying reset code:', error);
        setError('This password reset link has expired or is invalid. Please request a new link.');
        setVerifying(false);
      });
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password should be at least 6 characters long');
      return;
    }
    
    setError('');
    setMessage('');
    setLoading(true);
    
    try {
      // Complete the password reset process
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage('Password has been reset successfully');
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error('Error resetting password:', err);
      setError('Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 py-12 lg:px-8">
      {/* Header with Logo and Heading */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          alt="Leagues"
          src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
          className="mx-auto h-10 w-auto"
        />
        <h2 className="mt-10 text-center text-2xl font-bold tracking-tight text-white">
          Create new password
        </h2>
        {email && (
          <p className="mt-2 text-center text-sm text-gray-400">
            For {email}
          </p>
        )}
      </div>
      
      {/* Card with the Form */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md bg-white rounded-lg shadow p-8">
        {verifying ? (
          <div className="text-center py-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
            <p className="mt-2 text-gray-700">Verifying your reset link...</p>
          </div>
        ) : error && !email ? (
          <div className="text-center py-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="mt-2 text-red-600">{error}</p>
            <button
              onClick={() => navigate('/reset-password')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Request New Reset Link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Setting Password...' : 'Reset Password'}
              </button>
            </div>

            {message && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-600 text-center">
                {message}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 text-center">
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default CompletePasswordReset;