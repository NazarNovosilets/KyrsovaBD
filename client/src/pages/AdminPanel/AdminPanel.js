import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FootballersPanel from './FootballersPanel';
import './AdminPanel.css';
import ClubsPanel from './ClubsPanel';

const AdminPanel = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [adminName, setAdminName] = useState('');
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeToday: 0,
        avgPoints: 0,
        premiumUsers: 0
    });

    useEffect(() => {
        fetchUsers();
        const adminFullName = localStorage.getItem('fullName');
        setAdminName(adminFullName || 'Admin');
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            console.log('🔍 Завантажуємо користувачів...');
            const response = await fetch('/api/users/all', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            console.log('📡 Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Дані від сервера:', data);
                console.log('👥 Користувачів:', data.users);
                console.log('📊 Статистика:', data.stats);

                setUsers(data.users || []);
                setStats(data.stats);

                console.log('✅ Користувачів завантажено:', data.users.length);
            } else {
                console.error('❌ Помилка статусу:', response.status, response.statusText);
                const errorData = await response.json();
                console.error('❌ Помилка від сервера:', errorData);
            }
        } catch (error) {
            console.error('❌ Помилка з\'єднання:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login', { replace: true });
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm('Ви впевнені, що хочете видалити цього користувача?')) {
            try {
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    console.log('✅ Користувач видалено');
                    fetchUsers();
                } else {
                    alert('❌ Помилка видалення користувача');
                }
            } catch (error) {
                console.error('❌ Помилка:', error);
            }
        }
    };

    const handleEditUser = (userId) => {
        console.log('✏️ Редагування користувача:', userId);
    };

    const filteredUsers = users.filter(user =>
        user.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && activeTab === 'users') {
        return <div className="loading">Завантаження...</div>;
    }

    return (
        <div className="admin-container">
            {/* Header */}
            <header className="admin-header-top">
                <div className="header-left">
                    <div className="logo">👨‍💼 Admin Panel</div>
                    <span className="league-name">Fantasy League Manager</span>
                </div>
                <div className="header-right">
                    <button className="user-btn">👤 {adminName}</button>
                    <div className="manager-info">
                        <span className="rank-label">Administrator</span>
                        <span className="rank">System Manager</span>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="admin-tabs">
                <button 
                    className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 User Management
                </button>
                <button 
                    className={`tab-button ${activeTab === 'footballers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('footballers')}
                >
                    ⚽ Footballers Database
                </button>
                <button
                    className={`tab-button ${activeTab === 'clubs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('clubs')}
                >
                    🏢 Club Management
                </button>
            </div>

            {/* Users Tab Content */}
            {activeTab === 'users' && (
                <div className="admin-content">
                    {/* Header */}
                    <div className="admin-header">
                        <div className="header-left">
                            <h1>👥 Управління користувачами</h1>
                            <p>Керуйте всіма менеджерами фантастичної ліги</p>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="admin-stats-grid">
                        <div className="stat-card stat-total">
                            <div className="stat-content">
                                <h3>Всього користувачів</h3>
                                <p className="stat-number">{stats.totalUsers}</p>
                            </div>
                            <div className="stat-icon">👥</div>
                        </div>

                        <div className="stat-card stat-active">
                            <div className="stat-content">
                                <h3>Активних сьогодні</h3>
                                <p className="stat-number">{stats.activeToday}</p>
                            </div>
                            <div className="stat-icon">🟢</div>
                        </div>

                        <div className="stat-card stat-points">
                            <div className="stat-content">
                                <h3>Середні очки</h3>
                                <p className="stat-number">{Math.round(stats.avgPoints)}</p>
                            </div>
                            <div className="stat-icon">⭐</div>
                        </div>

                        <div className="stat-card stat-premium">
                            <div className="stat-content">
                                <h3>Premium користувачів</h3>
                                <p className="stat-number">{stats.premiumUsers}</p>
                            </div>
                            <div className="stat-icon">👑</div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="search-container">
                        <div className="search-box">
                            <input
                                type="text"
                                placeholder="Пошук користувачів за ім'ям..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="users-table-container">
                        <h2>Всі користувачі</h2>
                        <p className="table-subtitle">Переглядайте та керуйте всіма менеджерами фантастичної ліги</p>

                        <div className="table-wrapper">
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>Рейтинг</th>
                                        <th>Користувач</th>
                                        <th>Очки</th>
                                        <th>Статус</th>
                                        <th>Роль</th>
                                        <th>Дії</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user, index) => (
                                            <tr key={user.id}>
                                                <td className="rank-cell">
                                                    <span className="rank-badge">{index + 1}</span>
                                                </td>
                                                <td className="user-cell">
                                                    <div className="user-avatar">👤</div>
                                                    <div className="user-info">
                                                        <p className="user-name">{user.fullname}</p>
                                                        <p className="user-email">{user.email}</p>
                                                    </div>
                                                </td>
                                                <td className="points-cell">
                                                    {user.team_id ? (
                                                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
            {user.teampoints || 0}
        </span>
                                                    ) : (
                                                        <span style={{
                                                            fontSize: '0.85rem',
                                                            color: '#ff6b6b',
                                                            backgroundColor: 'rgba(255, 107, 107, 0.1)',
                                                            padding: '4px 10px',
                                                            borderRadius: '12px',
                                                            whiteSpace: 'nowrap'
                                                        }}>
            🚫 Немає команди
        </span>
                                                    )}
                                                </td>
                                                <td className="status-cell">
                                                    <span className="status-badge active">
                                                        🟢 Активний
                                                    </span>
                                                </td>
                                                <td className="role-cell">
                                                    <span className={`role-badge ${user.role}`}>
                                                        {user.role === 'admin' ? '👑 Admin' : user.role === 'premium' ? '⭐ Premium' : '📊 Standard'}
                                                    </span>
                                                </td>
                                                <td className="actions-cell">
                                                    <button
                                                        className="btn-action btn-edit"
                                                        onClick={() => handleEditUser(user.id)}
                                                        title="Редагувати"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="btn-action btn-delete"
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        title="Видалити"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="no-users">
                                                Користувачів не знайдено
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Footballers Tab */}
            {activeTab === 'footballers' && (
                <FootballersPanel />
            )}
            {activeTab === 'clubs' && (
                <ClubsPanel />
            )}
        </div>
    );
};

export default AdminPanel;
