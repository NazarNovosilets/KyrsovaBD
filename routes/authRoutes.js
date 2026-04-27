const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const leaderboardController = require('../controllers/leaderboardController');
const teamController = require('../controllers/teamController');
const matchController = require('../controllers/matchController');

// 🔐 Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// 📊 Leaderboard routes
router.get('/leaderboard', leaderboardController.getLeaderboard);
router.get('/stats/:userId', leaderboardController.getUserStats);
router.get('/top-managers', leaderboardController.getTopManagers);

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
router.get('/matches/:matchId', matchController.getMatchById);

module.exports = router;