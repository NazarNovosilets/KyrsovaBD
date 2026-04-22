#!/bin/bash

# SQL команди для оновлення балів користувачів в БД
# Запустіть цей файл або скопіюйте команди в ваше DB GUI

cat << 'EOF'

UPDATE Users SET totalpoints = 1850 WHERE id = 1;
UPDATE Users SET totalpoints = 1820 WHERE id = 3;
UPDATE Users SET totalpoints = 1785 WHERE id = 4;
UPDATE Users SET totalpoints = 1650 WHERE id = 2;

SELECT id, fullname, email, totalpoints FROM Users ORDER BY totalpoints DESC;

EOF

