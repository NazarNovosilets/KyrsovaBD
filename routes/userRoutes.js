const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const footballerController = require('../controllers/footballerController');
const importController = require('../controllers/importController');
const upload = multer({ storage: multer.memoryStorage() });

// 👥 User routes
router.get('/all', userController.getAllUsers);
router.delete('/:userId', userController.deleteUser);
router.put('/:userId', userController.updateUser);
router.patch('/:userId/role', userController.updateUserRole);

// 🏈 Footballer routes
router.get('/footballers/all', footballerController.getAllFootballers);
router.post('/footballers/add', footballerController.addFootballer);
router.put('/footballers/:footballerId', footballerController.updateFootballer);
router.delete('/footballers/:footballerId', footballerController.deleteFootballer);


const clubController = require('../controllers/clubController');

// 🏢 Club routes
router.get('/clubs', clubController.getAllClubs);
router.delete('/clubs/:id', clubController.deleteClub);

// 📥 Admin CSV import
router.post(
    '/import/csv',
    upload.fields([
        { name: 'clubsFile', maxCount: 1 },
        { name: 'footballersFile', maxCount: 1 },
        { name: 'matchesFile', maxCount: 1 },
        { name: 'ratingsFile', maxCount: 1 }
    ]),
    importController.importCsvBundle
);
module.exports = router;

