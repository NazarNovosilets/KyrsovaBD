const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const leaderboardController = require('../controllers/leaderboardController');
const teamController = require('../controllers/teamController');
const matchController = require('../controllers/matchController');
const analyticsController = require('../controllers/analyticsController');

// 🔐 Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// 📊 Leaderboard routes
router.get('/leaderboard', leaderboardController.getLeaderboard);
router.get('/stats/:userId', leaderboardController.getUserStats);
router.get('/top-managers', leaderboardController.getTopManagers);
router.get('/analytics/matches', analyticsController.getAnalystMatches);
router.get('/analytics/matches/:matchId/lineups', analyticsController.getMatchLineups);
router.post('/analytics/matches/:matchId/ratings', analyticsController.savePlayerRatings);
router.post('/analytics/matches/:matchId/statistics', analyticsController.savePlayerStatistics);
router.get('/analytics/matches/:matchId/events', analyticsController.getMatchEvents);
router.post('/analytics/matches/:matchId/events/generate', analyticsController.generateMatchEvent);
router.post('/analytics/matches/:matchId/events/:eventId/confirm-goal', analyticsController.confirmGoalEvent);
router.post('/analytics/matches/:matchId/events/:eventId/reject', analyticsController.rejectEvent);

// 👥 Team routes
router.get('/players', teamController.getAllPlayers);
router.get('/auth/players', teamController.getAllPlayers); // Додано для TeamBuilder
router.get('/players/:position', teamController.getPlayersByPosition);
router.get('/user-team/:userId', teamController.getUserTeam);
router.post('/save-team/:userId', teamController.saveUserTeam);

// 🎯 Match routes
router.get('/matches', matchController.getAllMatches);
router.get('/matches/fixtures', matchController.getFixtures);
router.get('/matches/gameweek/:gameweek', matchController.getMatchesByGameweek);
router.get('/matches/standings', matchController.getStandings);
router.get('/matches/results', matchController.getResults);
router.post('/matches/admin-create', matchController.createMatchByAdmin);
router.get('/matches/:matchId', matchController.getMatchById);

const clubController = require('../controllers/clubController');

// 🏢 Club routes
router.get('/clubs', clubController.getAllClubs);
router.delete('/clubs/:id', clubController.deleteClub);

router.post('/clubs', clubController.addClub);
module.exports = router;
