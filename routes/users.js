const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../database");
const router = express.Router();

const SALT_ROUNDS = 10;

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "All fields required" });

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    db.run(
      `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
      [username, email, hashedPassword],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, username, email });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ success: false, message: "User nao encontrado" });

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    } else {
      res.json({ success: false, message: "Senha Incorreta" });
    }
  });
});

module.exports = router;
