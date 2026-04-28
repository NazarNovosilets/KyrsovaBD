const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const footballerController = require('../controllers/footballerController');

// 👥 User routes
router.get('/all', userController.getAllUsers);
router.delete('/:userId', userController.deleteUser);
router.put('/:userId', userController.updateUser);

// 🏈 Footballer routes
router.get('/footballers/all', footballerController.getAllFootballers);
router.post('/footballers/add', footballerController.addFootballer);
router.put('/footballers/:footballerId', footballerController.updateFootballer);
router.delete('/footballers/:footballerId', footballerController.deleteFootballer);


const clubController = require('../controllers/clubController');

// 🏢 Club routes
router.get('/clubs', clubController.getAllClubs);
router.delete('/clubs/:id', clubController.deleteClub);
module.exports = router;

