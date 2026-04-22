import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Register.css';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        console.log('📝 Реєстрація з:', formData);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            console.log('🔄 Response status:', response.status);

            const data = await response.json();
            console.log('📦 Response data:', data);

            if (response.ok) {
                console.log('✅ Реєстрація успішна!');
                setMessage('✅ Реєстрація успішна! Перенаправлення на дашборд...');

                // 💾 Зберігаємо userId в localStorage
                localStorage.setItem('userId', String(data.userId));
                localStorage.setItem('email', data.email);
                localStorage.setItem('fullName', data.fullName);

                console.log('💾 Дані збережені в localStorage');

                setFormData({ username: '', email: '', password: '' });

                setTimeout(() => {
                    console.log('🚀 Перенаправляємо на /dashboard');
                    navigate('/dashboard', { replace: true });
                }, 1000);
            } else {
                console.log('❌ Помилка реєстрації:', data.error);
                setMessage(`❌ Помилка: ${data.error}`);
            }
        } catch (error) {
            console.error('❌ Помилка з\'єднання:', error);
            setMessage('❌ Не вдалося з\'єднатися з сервером');
        } finally {
            setLoading(false);
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
                            value={formData.username}
                            onChange={handleChange}
                            disabled={loading}
                            required
                        />
                    </div>
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
                        {loading ? 'Обробка...' : 'Sign Up'}
                    </button>
                </form>

                {message && <p className="status-message">{message}</p>}

                <p className="footer-text">
                    Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign In</a>
                </p>
            </div>
        </div>
    );
};

export default Register;