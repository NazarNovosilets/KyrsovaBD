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
        setMessage('');

        console.log('📝 Логіння з:', formData);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            console.log('🔄 Response status:', response.status);

            const data = await response.json();
            console.log('📦 Response data:', data);

            if (response.ok) {
                console.log('✅ Логін успішний!');
                setMessage('✅ Вхід успішний! Перенаправлення...');

                // 💾 Зберігаємо userId в localStorage
                localStorage.setItem('userId', String(data.userId));
                localStorage.setItem('email', data.email);
                localStorage.setItem('fullName', data.fullName);

                console.log('💾 Дані збережені в localStorage');
                console.log('userId:', localStorage.getItem('userId'));

                setFormData({ email: '', password: '' });

                // Перенаправлюємо на дашборд
                setTimeout(() => {
                    console.log('🚀 Перенаправляємо на /dashboard');
                    navigate('/dashboard', { replace: true });
                }, 1000);
            } else {
                console.log('❌ Помилка логіну:', data.error);
                setMessage(`❌ Помилка: ${data.error}`);
            }
        } catch (error) {
            console.error('❌ Помилка з\'єднання:', error);
            setMessage('❌ Помилка з\'єднання. Перевірте сервер');
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