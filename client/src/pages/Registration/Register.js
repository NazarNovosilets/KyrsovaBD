import React, { useState } from 'react';
import './Register.css';

const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            if (response.ok) {
                setMessage('✅ Реєстрація успішна!');
            } else {
                setMessage(`❌ Помилка: ${data.error}`);
            }
        } catch (error) {
            setMessage('❌ Не вдалося з’єднатися з сервером');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="logo-box">🏆</div>
                <h1>UPL Fantasy League</h1>
                <p className="subtitle">Build your dream Ukrainian Premier League team</p>

                <h2 className="welcome-title">Create Account</h2>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Username</label>
                        <input
                            type="text"
                            name="username"
                            placeholder="Nazar"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="your.email@example.com"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary">Sign Up</button>
                </form>

                {message && <p className="status-message">{message}</p>}

                <p className="footer-text">
                    Already have an account? <a href="/login">Sign In</a>
                </p>
            </div>
        </div>
    );
};

export default Register;