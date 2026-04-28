import React, { useEffect, useMemo, useState } from 'react';

const defaultForm = {
    homeClubId: '',
    awayClubId: '',
    kickoffAt: '',
    status: 'upcoming',
    matchday: 1
};

const MatchesPanel = () => {
    const [clubs, setClubs] = useState([]);
    const [form, setForm] = useState(defaultForm);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');

    useEffect(() => {
        const fetchClubs = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/auth/clubs');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Не вдалося завантажити клуби');
                }

                const normalized = (data.clubs || []).map((club) => ({
                    id: club.id || club.Id,
                    name: club.name || club.Name
                }));
                setClubs(normalized);
            } catch (error) {
                setMessage(error.message);
                setMessageType('error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchClubs();
    }, []);

    const availableAwayClubs = useMemo(() => {
        if (!form.homeClubId) return clubs;
        return clubs.filter((club) => String(club.id) !== String(form.homeClubId));
    }, [clubs, form.homeClubId]);

    const onInputChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setForm(defaultForm);
    };

    const onSubmit = async (event) => {
        event.preventDefault();
        setMessage('');

        if (!form.homeClubId || !form.awayClubId || !form.kickoffAt) {
            setMessage('Оберіть обидві команди та дату/час матчу');
            setMessageType('error');
            return;
        }

        if (String(form.homeClubId) === String(form.awayClubId)) {
            setMessage('Домашня і гостьова команда мають бути різні');
            setMessageType('error');
            return;
        }

        try {
            setIsSaving(true);
            const response = await fetch('/api/auth/matches/admin-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeClubId: Number(form.homeClubId),
                    awayClubId: Number(form.awayClubId),
                    kickoffAt: form.kickoffAt,
                    status: form.status,
                    matchday: Number(form.matchday) || 1
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Не вдалося створити матч');
            }

            setMessage(`Матч успішно створено (ID: ${data.match.id})`);
            setMessageType('success');
            resetForm();
        } catch (error) {
            setMessage(error.message);
            setMessageType('error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="loading">Завантаження клубів...</div>;
    }

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-left">
                    <h1>🗓️ Match Management</h1>
                    <p>Створюй матчі вручну: вибір команд, дата/час і статус</p>
                </div>
            </div>

            <div className="users-table-container" style={{ maxWidth: '720px' }}>
                <h2>Створити новий матч</h2>
                <p className="table-subtitle">Адмін може створити live або upcoming матч на потрібний час</p>

                <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Домашня команда</label>
                        <select
                            className="search-input"
                            name="homeClubId"
                            value={form.homeClubId}
                            onChange={onInputChange}
                            required
                        >
                            <option value="">Оберіть домашню команду</option>
                            {clubs.map((club) => (
                                <option key={club.id} value={club.id}>
                                    {club.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Гостьова команда</label>
                        <select
                            className="search-input"
                            name="awayClubId"
                            value={form.awayClubId}
                            onChange={onInputChange}
                            required
                        >
                            <option value="">Оберіть гостьову команду</option>
                            {availableAwayClubs.map((club) => (
                                <option key={club.id} value={club.id}>
                                    {club.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Дата і час матчу</label>
                        <input
                            className="search-input"
                            type="datetime-local"
                            name="kickoffAt"
                            value={form.kickoffAt}
                            onChange={onInputChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Статус</label>
                        <select
                            className="search-input"
                            name="status"
                            value={form.status}
                            onChange={onInputChange}
                        >
                            <option value="upcoming">upcoming</option>
                            <option value="live">live</option>
                            <option value="finished">finished</option>
                            <option value="postponed">postponed</option>
                            <option value="cancelled">cancelled</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Тур (matchday)</label>
                        <input
                            className="search-input"
                            type="number"
                            min="1"
                            name="matchday"
                            value={form.matchday}
                            onChange={onInputChange}
                        />
                    </div>

                    {message ? (
                        <div
                            style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                background: messageType === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: messageType === 'success' ? '#6ee7b7' : '#fca5a5',
                                border: '1px solid rgba(255,255,255,0.15)'
                            }}
                        >
                            {message}
                        </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="logout-btn" type="submit" disabled={isSaving}>
                            {isSaving ? 'Створення...' : 'Створити матч'}
                        </button>
                        <button className="user-btn" type="button" onClick={resetForm} disabled={isSaving}>
                            Очистити
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MatchesPanel;
