const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const leaderboardController = require('../controllers/leaderboardController');

// 🔐 Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// 📊 Leaderboard routes
router.get('/leaderboard', leaderboardController.getLeaderboard);
router.get('/stats/:userId', leaderboardController.getUserStats);
router.get('/top-managers', leaderboardController.getTopManagers);

module.exports = router;