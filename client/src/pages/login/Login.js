import React, { useState } from 'react';
import '../Registration/Register.css'; // Використовуємо ті ж самі стилі для ідентичного вигляду

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await response.json();

            if (response.ok) {
                setMessage('✅ Вхід успішний!');
                // Тут можна додати перехід на головну: window.location.href = '/dashboard';
            } else {
                setMessage(`❌ Помилка: ${data.error}`);
            }
        } catch (error) {
            setMessage('❌ Помилка з’єднання');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="logo-box">🏆</div>
                <h1>UPL Fantasy League</h1>
                <p className="subtitle">Sign in to manage your fantasy team</p>

                <h2 className="welcome-title">Welcome Back</h2>

                <form onSubmit={handleSubmit}>
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
                    <button type="submit" className="btn-primary">Sign In</button>
                </form>

                {message && <p className="status-message">{message}</p>}

                <p className="footer-text">
                    Don't have an account? <a href="/register">Sign Up for free</a>
                </p>
            </div>
        </div>
    );
};

export default Login;