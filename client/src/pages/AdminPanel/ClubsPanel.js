import React, { useState, useEffect } from 'react';

const ClubsPanel = () => {
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Стан для універсального модального вікна повідомлень/підтверджень
    const [modal, setModal] = useState({
        isOpen: false, type: 'confirm', title: '', message: '', onConfirm: null
    });

    // Стан для модального вікна ДОДАВАННЯ клубу
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newClub, setNewClub] = useState({ name: '', city: '' });

    // Мапінг кольорів та коротких назв
    const teamMetadata = {
        'Шахтар': { primary: '#FF6B00', secondary: '#000000', short: 'SHA' },
        'Динамо': { primary: '#0066CC', secondary: '#FFFFFF', short: 'DYN' },
        'Полісся': { primary: '#00AA00', secondary: '#FFDD00', short: 'POL' },
        'Кривбас': { primary: '#E32221', secondary: '#FFFFFF', short: 'KRY' },
        'ЛНЗ': { primary: '#5A2E8F', secondary: '#FFFFFF', short: 'LNZ' },
        'Олександрія': { primary: '#FFDD00', secondary: '#0066CC', short: 'OLE' },
        'Рух': { primary: '#FFFF00', secondary: '#000000', short: 'RUK' },
        'Зоря': { primary: '#000000', secondary: '#FFFFFF', short: 'ZOR' }
    };

    const getMetadata = (clubName) => {
        if (!clubName) return { primary: '#666666', secondary: '#CCCCCC', short: 'UNK' };
        return teamMetadata[clubName] || {
            primary: '#666666', secondary: '#CCCCCC', short: clubName.substring(0, 3).toUpperCase()
        };
    };

    useEffect(() => {
        fetchClubs();
    }, []);

    const fetchClubs = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/auth/clubs');
            if (response.ok) {
                const data = await response.json();
                setClubs(data.clubs || []);
            }
        } catch (error) {
            console.error('Помилка при завантаженні клубів:', error);
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => setModal({ ...modal, isOpen: false });
    const showAlert = (title, message) => setModal({ isOpen: true, type: 'alert', title, message, onConfirm: null });

    // --- ЛОГІКА ДОДАВАННЯ ---
    const submitNewClub = async () => {
        if (!newClub.name || !newClub.city) {
            showAlert('⚠️ Увага', 'Будь ласка, заповніть і назву, і місто клубу.');
            return;
        }

        try {
            const response = await fetch('/api/auth/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newClub)
            });

            if (response.ok) {
                setAddModalOpen(false);
                setNewClub({ name: '', city: '' }); // Очищаємо форму
                fetchClubs(); // Оновлюємо таблицю
                showAlert('✅ Успіх', `Клуб "${newClub.name}" успішно додано!`);
            } else {
                const errorData = await response.json();
                showAlert('❌ Помилка', errorData.error);
            }
        } catch (error) {
            showAlert('❌ Помилка', 'Сталася помилка при з\'єднанні з сервером');
        }
    };

    // --- ЛОГІКА ВИДАЛЕННЯ ---
    const handleDeleteClick = (id, clubName) => {
        setModal({
            isOpen: true, type: 'confirm',
            title: '⚠️ Підтвердження видалення',
            message: `Ви впевнені, що хочете видалити клуб "${clubName}"? Всі пов'язані футболісти будуть видалені!`,
            onConfirm: () => executeDelete(id)
        });
    };

    const executeDelete = async (id) => {
        closeModal();
        try {
            const response = await fetch(`/api/auth/clubs/${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchClubs();
            } else {
                const errorData = await response.json();
                showAlert('❌ Помилка', errorData.error);
            }
        } catch (error) {
            showAlert('❌ Помилка', 'Сталася помилка при з\'єднанні з сервером');
        }
    };

    const filteredClubs = clubs.filter(club => {
        const clubName = club.name || club.Name || '';
        const clubCity = club.city || club.City || '';
        return clubName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            clubCity.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (loading) return <div className="loading">Завантаження клубів...</div>;

    // Спільний стиль для інпутів
    const inputStyle = {
        width: '100%', padding: '12px', borderRadius: '8px',
        backgroundColor: '#0f1623', border: '1px solid #2a344a',
        color: 'white', marginBottom: '15px', boxSizing: 'border-box'
    };

    return (
        <div className="admin-content" style={{ position: 'relative' }}>
            {/* Header */}
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="header-left">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#FFD700' }}>🏢</span> Club Management
                    </h1>
                    <p>Manage all UPL football clubs</p>
                </div>
                {/* Кнопка відкриває модалку додавання */}
                <button
                    onClick={() => setAddModalOpen(true)}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#0066CC', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    + Add New Club
                </button>
            </div>

            {/* Total Stat Card */}
            <div style={{ backgroundColor: '#0052cc', color: 'white', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Total UPL Clubs</p>
                    <h2 style={{ margin: '5px 0 0 0', fontSize: '2.5rem' }}>{clubs.length}</h2>
                </div>
                <div style={{ fontSize: '3rem', opacity: 0.8, color: '#FFD700' }}>🏢</div>
            </div>

            {/* Search Bar */}
            <div className="search-container" style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="🔍 Search clubs by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '15px', borderRadius: '10px', backgroundColor: '#1a2235', border: '1px solid #2a344a', color: 'white', boxSizing: 'border-box' }}
                />
            </div>

            {/* Clubs Table */}
            <div className="users-table-container" style={{ backgroundColor: '#1a2235', padding: '20px', borderRadius: '12px' }}>
                <h2>All Clubs</h2>
                <p className="table-subtitle">Manage all football clubs in the Ukrainian Premier League</p>

                <table className="users-table" style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ borderBottom: '1px solid #2a344a', textAlign: 'left', color: '#8892b0' }}>
                        <th style={{ padding: '15px' }}>Logo</th>
                        <th style={{ padding: '15px' }}>Club Name</th>
                        <th style={{ padding: '15px' }}>Short Name</th>
                        <th style={{ padding: '15px' }}>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredClubs.map(club => {
                        const clubId = club.id || club.Id;
                        const clubName = club.name || club.Name;
                        const clubCity = club.city || club.City;
                        const meta = getMetadata(clubName);

                        return (
                            <tr key={clubId} style={{ borderBottom: '1px solid #2a344a' }}>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: meta.primary }}></div>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: meta.secondary, marginLeft: '-8px', border: '2px solid #1a2235' }}></div>
                                    </div>
                                </td>
                                <td style={{ padding: '15px', fontWeight: 'bold' }}>{clubName} ({clubCity})</td>
                                <td style={{ padding: '15px', fontWeight: 'bold', color: '#FFD700' }}>{meta.short}</td>
                                <td style={{ padding: '15px' }}>
                                    <button style={{ background: 'transparent', border: 'none', color: '#0066CC', cursor: 'pointer', fontSize: '1.2rem', marginRight: '10px' }}>📝</button>
                                    <button
                                        onClick={() => handleDeleteClick(clubId, clubName)}
                                        style={{ background: 'transparent', border: 'none', color: '#FF4444', cursor: 'pointer', fontSize: '1.2rem' }}
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {/* ВІКНО ДОДАВАННЯ КЛУБУ */}
            {addModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 9999, backdropFilter: 'blur(3px)'
                }}>
                    <div style={{
                        backgroundColor: '#1a2235', padding: '30px', borderRadius: '16px',
                        width: '400px', maxWidth: '90%', border: '1px solid #2a344a',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: 'white'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.4rem' }}>➕ Додати новий клуб</h3>

                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#8892b0' }}>Назва клубу</label>
                        <input
                            type="text"
                            placeholder="Напр. Верес"
                            value={newClub.name}
                            onChange={(e) => setNewClub({...newClub, name: e.target.value})}
                            style={inputStyle}
                        />

                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#8892b0' }}>Місто</label>
                        <input
                            type="text"
                            placeholder="Напр. Рівне"
                            value={newClub.city}
                            onChange={(e) => setNewClub({...newClub, city: e.target.value})}
                            style={inputStyle}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginTop: '15px' }}>
                            <button onClick={() => setAddModalOpen(false)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #4a5568', backgroundColor: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}>
                                Скасувати
                            </button>
                            <button onClick={submitNewClub} style={{ padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#0066CC', color: 'white', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}>
                                Зберегти
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* СПІЛЬНЕ МОДАЛЬНЕ ВІКНО ПОВІДОМЛЕНЬ */}
            {modal.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10000, backdropFilter: 'blur(3px)'
                }}>
                    <div style={{
                        backgroundColor: '#1a2235', padding: '30px', borderRadius: '16px',
                        width: '400px', maxWidth: '90%', border: '1px solid #2a344a',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center', color: 'white'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.4rem' }}>{modal.title}</h3>
                        <p style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>{modal.message}</p>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                            {modal.type === 'confirm' ? (
                                <>
                                    <button onClick={closeModal} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #4a5568', backgroundColor: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}>Скасувати</button>
                                    <button onClick={modal.onConfirm} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#FF4444', color: 'white', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}>Так, видалити</button>
                                </>
                            ) : (
                                <button onClick={closeModal} style={{ padding: '10px 30px', borderRadius: '8px', border: 'none', backgroundColor: '#0066CC', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>OK</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClubsPanel;