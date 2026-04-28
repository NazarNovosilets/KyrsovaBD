// EXAMPLE: Як працює функція зміни ролі на бекенду

// В userController.js була додана нова функція:
exports.updateUserRole = async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    try {
        // Логування
        console.log(`🔄 Спроба змінити роль користувача ${userId} на ${role}`);

        // Крок 1: Перевіряємо чи користувач існує та чи він не адмін
        const userCheck = await db.query(
            'SELECT id, role FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            console.log(`❌ Користувач ${userId} не знайдений`);
            return res.status(404).json({ error: 'Користувач не знайдений' });
        }

        const user = userCheck.rows[0];

        // Крок 2: КЛЮЧОВА ПЕРЕВІРКА - захист адмінів
        if (user.role === 'admin') {
            console.log(`❌ Спроба змінити роль адміна ${userId}`);
            return res.status(403).json({
                error: 'Не можна змінювати роль адміністраторів'
            });
        }

        // Крок 3: Перевіряємо валідність нової ролі
        const validRoles = ['user', 'analyst', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: 'Невалідна роль. Дозволені ролі: user, analyst, admin'
            });
        }

        // Крок 4: Оновлюємо роль
        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, fullname, email, role',
            [role, userId]
        );

        // Успіх!
        console.log(`✅ Роль користувача ${userId} змінена на ${role}`);
        res.status(200).json({
            message: 'Роль користувача успішно змінена',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Помилка при зміні ролі користувача:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

// На фронтенді в AdminPanel.js:
const handleChangeRole = (user) => {
    // Перевіряємо чи це адмін
    if (user.role === 'admin') {
        alert('❌ Не можна змінювати роль адміністраторів');
        return;
    }

    // Відкриваємо модаль
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
};

const handleSaveRole = async () => {
    if (!selectedUser) return;

    try {
        const response = await fetch(`/api/users/${selectedUser.id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });

        if (response.ok) {
            console.log('✅ Роль успішно змінена');
            setShowRoleModal(false);
            fetchUsers(); // Оновлюємо список
        } else {
            const errorData = await response.json();
            alert('❌ Помилка: ' + errorData.error);
        }
    } catch (error) {
        console.error('❌ Помилка:', error);
        alert('❌ Помилка при зміні ролі');
    }
};

// ПРИКЛАДИ ЗАПИТІВ:

// 1. Змінити користувача на Analyst (УСПІХ)
// curl -X PATCH http://localhost:3000/api/users/5/role \
//   -H "Content-Type: application/json" \
//   -d '{"role": "analyst"}'
//
// Response 200:
// {
//   "message": "Роль користувача успішно змінена",
//   "user": {
//     "id": 5,
//     "fullname": "John Doe",
//     "email": "john@example.com",
//     "role": "analyst"
//   }
// }

// 2. Спроба змінити адміна (ПОМИЛКА)
// curl -X PATCH http://localhost:3000/api/users/1/role \
//   -H "Content-Type: application/json" \
//   -d '{"role": "user"}'
//
// Response 403:
// {
//   "error": "Не можна змінювати роль адміністраторів"
// }

// 3. Невалідна роль (ПОМИЛКА)
// curl -X PATCH http://localhost:3000/api/users/5/role \
//   -H "Content-Type: application/json" \
//   -d '{"role": "superadmin"}'
//
// Response 400:
// {
//   "error": "Невалідна роль. Дозволені ролі: user, analyst, admin"
// }



