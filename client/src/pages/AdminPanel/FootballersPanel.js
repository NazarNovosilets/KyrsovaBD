import React, { useState, useEffect } from 'react';
import './FootballersPanel.css';

const FootballersPanel = () => {
    const [footballers, setFootballers] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        totalPlayers: 0,
        goalkeepers: 0,
        defenders: 0,
        attackers: 0
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingFootballer, setEditingFootballer] = useState(null);
    const [formData, setFormData] = useState({
        firstname: '',
        lastname: '',
        position: 'GK',
        footballclubid: 1,
        marketvalue: 5.0
    });

    useEffect(() => {
        fetchFootballers();
        fetchClubs();
    }, []);

    const fetchFootballers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/users/footballers/all', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                setFootballers(data.footballers);
                setStats(data.stats);
                console.log('✅ Футболістів завантажено:', data.footballers.length);
            } else {
                console.error('❌ Помилка завантаження футболістів');
            }
        } catch (error) {
            console.error('❌ Помилка з\'єднання:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchClubs = async () => {
        try {
            console.log('🏢 Отримання списку клубів');
            const response = await fetch('/api/users/clubs', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📦 Отримані дані з сервера:', data);
                // Трансформуємо формат: { Id, Name, City } -> { id, name }
                const clubsList = data.clubs.map(club => ({
                    id: club.Id || club.id,
                    name: club.Name || club.name
                }));
                console.log('📋 Трансформовані клуби:', clubsList);
                setClubs(clubsList);
                console.log('✅ Клубів завантажено:', clubsList.length);
            } else {
                console.error('❌ Помилка завантаження клубів, статус:', response.status);
                const errorData = await response.json();
                console.error('❌ Помилка:', errorData);
            }
        } catch (error) {
            console.error('❌ Помилка при отриманні клубів:', error);
        }
    };

    const handleDeleteFootballer = async (footballerId) => {
        if (window.confirm('Ви впевнені, що хочете видалити цього футболіста?')) {
            try {
                const response = await fetch(`/api/users/footballers/${footballerId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    console.log('✅ Футболіст видалено');
                    fetchFootballers();
                } else {
                    alert('❌ Помилка видалення футболіста');
                }
            } catch (error) {
                console.error('❌ Помилка:', error);
            }
        }
    };

    const handleEditFootballer = (footballer) => {
        console.log('✏️ Редагування футболіста:', footballer);
        setEditingFootballer(footballer);
        const [firstname, lastname] = footballer.name.split(' ');
        setFormData({
            firstname: firstname || '',
            lastname: lastname || '',
            position: footballer.position || 'GK',
            footballclubid: 1,
            marketvalue: footballer.price || 5.0
        });
        setShowEditModal(true);
    };

    const handleUpdateFootballer = async () => {
        if (!formData.firstname || !formData.lastname) {
            alert('Заповніть обов\'язкові поля');
            return;
        }

        try {
            const response = await fetch(`/api/users/footballers/${editingFootballer.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                console.log('✅ Футболіста оновлено');
                setShowEditModal(false);
                setEditingFootballer(null);
                fetchFootballers();
            } else {
                alert('❌ Помилка оновлення футболіста');
            }
        } catch (error) {
            console.error('❌ Помилка:', error);
        }
    };

    const handleAddFootballer = async () => {
        if (!formData.firstname || !formData.lastname) {
            alert('Заповніть обов\'язкові поля');
            return;
        }

        try {
            const response = await fetch('/api/users/footballers/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                console.log('✅ Футболіста додано');
                setShowAddModal(false);
                setFormData({
                    firstname: '',
                    lastname: '',
                    position: 'GK',
                    footballclubid: 1,
                    marketvalue: 5.0
                });
                fetchFootballers();
            } else {
                alert('❌ Помилка додавання футболіста');
            }
        } catch (error) {
            console.error('❌ Помилка:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'marketvalue' ? parseFloat(value) : value
        }));
    };

    const handleOpenAddModal = () => {
        // Очищаємо форму перед відкриттям модалі
        setFormData({
            firstname: '',
            lastname: '',
            position: 'GK',
            footballclubid: 1,
            marketvalue: 5.0
        });
        setShowAddModal(true);
    };

    const filteredFootballers = footballers.filter(fb =>
        fb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (fb.club && fb.club.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getPositionBadge = (position) => {
        const badges = {
            'GK': { text: 'GK', color: '#fbbf24' },
            'DEF': { text: 'DEF', color: '#60a5fa' },
            'MID': { text: 'MID', color: '#34d399' },
            'FWD': { text: 'FWD', color: '#f87171' }
        };
        return badges[position] || { text: position, color: '#94a3b8' };
    };

    if (loading) {
        return <div className="loading">Завантаження...</div>;
    }

    return (
        <div className="footballers-panel">
            {/* Header */}
            <div className="footballers-header">
                <div className="header-left">
                    <h1>⚽ Footballers Database</h1>
                    <p>Manage all players in the UPL system</p>
                </div>
                <button className="btn-add-footballer" onClick={handleOpenAddModal}>
                    + Add New Footballer
                </button>
            </div>

            {/* Statistics */}
            <div className="stats-grid">
                <div className="stat-card stat-total">
                    <h3>Total Players</h3>
                    <p className="stat-number">{stats.totalPlayers}</p>
                </div>

                <div className="stat-card stat-gk">
                    <h3>Goalkeepers</h3>
                    <p className="stat-number" style={{ color: '#fbbf24' }}>{stats.goalkeepers}</p>
                </div>

                <div className="stat-card stat-def">
                    <h3>Defenders</h3>
                    <p className="stat-number" style={{ color: '#60a5fa' }}>{stats.defenders}</p>
                </div>

                <div className="stat-card stat-att">
                    <h3>Attackers</h3>
                    <p className="stat-number" style={{ color: '#f87171' }}>{stats.attackers}</p>
                </div>
            </div>

            {/* Search */}
            <div className="search-container">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search players by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {/* Footballers Table */}
            <div className="footballers-table-container">
                <h2>All Footballers</h2>
                <p className="table-subtitle">Manage player information, pricing, and statistics</p>

                <div className="table-wrapper">
                    <table className="footballers-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Position</th>
                                <th>Club</th>
                                <th>Price</th>
                                <th>Points</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFootballers.length > 0 ? (
                                filteredFootballers.map((footballer) => {
                                    const posBadge = getPositionBadge(footballer.position);
                                    return (
                                        <tr key={footballer.id}>
                                            <td className="player-cell">
                                                <div className="player-avatar">⚽</div>
                                                <span className="player-name">{footballer.name}</span>
                                            </td>
                                            <td className="position-cell">
                                                <span className="position-badge" style={{ backgroundColor: posBadge.color + '30', color: posBadge.color }}>
                                                    {posBadge.text}
                                                </span>
                                            </td>
                                            <td className="club-cell">
                                                <div className="club-icon">⚪🔵</div>
                                                <span>{footballer.club || 'N/A'}</span>
                                            </td>
                                            <td className="price-cell">£{footballer.price?.toFixed(1)}M</td>
                                            <td className="points-cell">
                                                <span className="points-badge">{footballer.points}</span>
                                            </td>
                                            <td className="actions-cell">
                                                <button
                                                    className="btn-action btn-edit"
                                                    title="Edit"
                                                    onClick={() => handleEditFootballer(footballer)}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn-action btn-delete"
                                                    onClick={() => handleDeleteFootballer(footballer.id)}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="no-footballers">
                                        No footballers found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Footballer Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Add New Footballer</h2>
                            <button className="btn-close" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>First Name *</label>
                                <input
                                    type="text"
                                    name="firstname"
                                    value={formData.firstname}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Heoriy"
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Name *</label>
                                <input
                                    type="text"
                                    name="lastname"
                                    value={formData.lastname}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Bushchan"
                                />
                            </div>
                            <div className="form-group">
                                <label>Position</label>
                                <select name="position" value={formData.position} onChange={handleInputChange}>
                                    <option value="GK">Goalkeeper (GK)</option>
                                    <option value="DEF">Defender (DEF)</option>
                                    <option value="MID">Midfielder (MID)</option>
                                    <option value="FWD">Forward (FWD)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Club</label>
                                <select name="footballclubid" value={formData.footballclubid} onChange={handleInputChange}>
                                    {clubs.map((club, index) => (
                                        <option key={`club-add-${club.id}-${index}`} value={club.id}>
                                            {club.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Market Value (£M)</label>
                                <input
                                    type="number"
                                    name="marketvalue"
                                    value={formData.marketvalue}
                                    onChange={handleInputChange}
                                    step="0.1"
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn-submit" onClick={handleAddFootballer}>Add Footballer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Footballer Modal */}
            {showEditModal && editingFootballer && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Edit Footballer</h2>
                            <button className="btn-close" onClick={() => setShowEditModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>First Name *</label>
                                <input
                                    type="text"
                                    name="firstname"
                                    value={formData.firstname}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Heoriy"
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Name *</label>
                                <input
                                    type="text"
                                    name="lastname"
                                    value={formData.lastname}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Bushchan"
                                />
                            </div>
                            <div className="form-group">
                                <label>Position</label>
                                <select name="position" value={formData.position} onChange={handleInputChange}>
                                    <option value="GK">Goalkeeper (GK)</option>
                                    <option value="DEF">Defender (DEF)</option>
                                    <option value="MID">Midfielder (MID)</option>
                                    <option value="FWD">Forward (FWD)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Club</label>
                                <select name="footballclubid" value={formData.footballclubid} onChange={handleInputChange}>
                                    {clubs.map((club, index) => (
                                        <option key={`club-edit-${club.id}-${index}`} value={club.id}>
                                            {club.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Market Value (£M)</label>
                                <input
                                    type="number"
                                    name="marketvalue"
                                    value={formData.marketvalue}
                                    onChange={handleInputChange}
                                    step="0.1"
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
                            <button className="btn-submit" onClick={handleUpdateFootballer}>Update Footballer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FootballersPanel;

