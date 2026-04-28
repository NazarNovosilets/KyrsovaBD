import React, { useState } from 'react';
import './DataImportPanel.css';

const DataImportPanel = () => {
    const [clubsFile, setClubsFile] = useState(null);
    const [footballersFile, setFootballersFile] = useState(null);
    const [matchesFile, setMatchesFile] = useState(null);
    const [ratingsFile, setRatingsFile] = useState(null);
    const [replaceExisting, setReplaceExisting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setResult(null);

        if (!clubsFile || !footballersFile || !matchesFile || !ratingsFile) {
            setError('Завантаж всі 4 файли перед імпортом');
            return;
        }

        const formData = new FormData();
        formData.append('clubsFile', clubsFile);
        formData.append('footballersFile', footballersFile);
        formData.append('matchesFile', matchesFile);
        formData.append('ratingsFile', ratingsFile);
        formData.append('replaceExisting', String(replaceExisting));

        try {
            setIsUploading(true);
            const response = await fetch('/api/users/import/csv', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Помилка імпорту');
            }
            setResult(data.imported || null);
        } catch (e) {
            setError(e.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-left">
                    <h1>📥 Data Import</h1>
                    <p>Імпорт CSV у таблиці clubs, footballers, matches, analyst ratings</p>
                </div>
            </div>

            <div className="users-table-container" style={{ maxWidth: '760px' }}>
                <h2>Завантаження файлів</h2>
                <p className="table-subtitle">Підтримується пакет із 4 файлів: clubs, footballers, matches, ratings</p>

                <form onSubmit={handleSubmit} className="import-form">
                    <label className="import-file-field">
                        <span className="import-file-label">Клуби (`football_clubs_upl.csv`)</span>
                        <input className="import-file-input" type="file" accept=".csv,text/csv" onChange={(e) => setClubsFile(e.target.files?.[0] || null)} />
                    </label>

                    <label className="import-file-field">
                        <span className="import-file-label">Футболісти (`footballers_v2_decimal.csv`)</span>
                        <input className="import-file-input" type="file" accept=".csv,text/csv" onChange={(e) => setFootballersFile(e.target.files?.[0] || null)} />
                    </label>

                    <label className="import-file-field">
                        <span className="import-file-label">Матчі (`matches_data.csv`)</span>
                        <input className="import-file-input" type="file" accept=".csv,text/csv" onChange={(e) => setMatchesFile(e.target.files?.[0] || null)} />
                    </label>

                    <label className="import-file-field">
                        <span className="import-file-label">Оцінки аналітика (`analyst_player_ratings.csv`)</span>
                        <input className="import-file-input" type="file" accept=".csv,text/csv" onChange={(e) => setRatingsFile(e.target.files?.[0] || null)} />
                    </label>

                    <label className="import-replace-toggle">
                        <input
                            type="checkbox"
                            checked={replaceExisting}
                            onChange={(e) => setReplaceExisting(e.target.checked)}
                        />
                        <span>
                            Replace mode: перед імпортом видалити існуючі записи з такими ж ID / matchID з файлів
                        </span>
                    </label>

                    {error ? (
                        <div className="import-message import-message-error">
                            {error}
                        </div>
                    ) : null}

                    {result ? (
                        <div className="import-message import-message-success">
                            Імпорт завершено: clubs `{result.clubs}`, footballers `{result.footballers}`, matches `{result.matches}`, ratings `{result.ratings}`
                        </div>
                    ) : null}

                    <button className="logout-btn" type="submit" disabled={isUploading}>
                        {isUploading ? 'Імпортую...' : 'Імпортувати CSV'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default DataImportPanel;
