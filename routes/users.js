const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")
const db = require("../database");
const router = express.Router();

const { SECRET_KEY, REFRESH_SECRET_KEY } = require("../config")
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

      const accessToken = jwt.sign({
        id: user.id, username: user.username
      }, SECRET_KEY, { expiresIn: "15m" })

      const refreshToken = jwt.sign({
        id: user.id,
        username: user.username
      }, REFRESH_SECRET_KEY, { expiresIn: "7d" })

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false, // trocar quando for fazer deploy
        sameSite: "strict"
      })
      res.json({ accessToken });
    } else {
      res.json({ success: false, message: "Senha Incorreta" });
    }
  });
});

router.post("/refresh", (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).send("Sem refresh token");

  try {
    const payload = jwt.verify(token, REFRESH_SECRET_KEY);
    const newAcess = jwt.sign({
      id: payload.id,
      username: payload.username
    }, SECRET_KEY, { expiresIn: "15m" })
    res.json({ accessToken: newAcess })
  } catch {
    res.status(401).send("Invalid Refresh");
  }
})

module.exports = router;
