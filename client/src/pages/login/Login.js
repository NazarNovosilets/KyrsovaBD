import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Registration/Register.css'; // Використовуємо ті ж самі стилі для ідентичного вигляду

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await response.json();

            if (response.ok) {
                setMessage('✅ Вхід успішний!');
                setFormData({ email: '', password: '' });
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
                // Тут можна додати збереження токена: localStorage.setItem('token', data.token);
            } else {
                setMessage(`❌ Помилка: ${data.error}`);
            }
        } catch (error) {
            setMessage('❌ Помилка з\'єднання');
        } finally {
            setLoading(false);
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
                            value={formData.email}
                            onChange={handleChange}
                            disabled={loading}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Обробка...' : 'Sign In'}
                    </button>
                </form>

                {message && <p className="status-message">{message}</p>}

                <p className="footer-text">
                    Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Sign Up for free</a>
                </p>
            </div>
        </div>
    );
};

export default Login;