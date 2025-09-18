
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for the login link!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md">
            <h1 className="text-4xl font-bold text-white text-center mb-2">Gemini CRM</h1>
            <p className="text-text-secondary text-center mb-8">
              Sign in to access your intelligent CRM
            </p>

            <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <form onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                            <input
                                className="w-full bg-accent p-3 rounded-md text-white focus:ring-2 focus:ring-highlight outline-none"
                                type="email"
                                placeholder="Your email"
                                value={email}
                                required
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
                            <input
                                className="w-full bg-accent p-3 rounded-md text-white focus:ring-2 focus:ring-highlight outline-none"
                                type="password"
                                placeholder="Your password"
                                value={password}
                                required
                                minLength={6}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
                    {message && <p className="mt-4 text-center text-sm text-green-400">{message}</p>}

                    <div className="mt-6">
                        <button className="w-full bg-highlight text-white p-3 rounded-md font-medium hover:bg-blue-500 disabled:bg-gray-500" disabled={loading}>
                            {loading ? <span>Loading...</span> : <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>}
                        </button>
                    </div>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                            setMessage('');
                        }}
                        className="text-sm text-text-secondary hover:text-white hover:underline"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
