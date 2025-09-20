const express = require("express");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");
const db = require("../database");

const router = express.Router();

function authenticate(req, res, next) {
  const token = req.body.token || req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ error: "Token obrigatório" });
  }

  try {
    const payload = jwt.verify(token.replace("Bearer ", ""), SECRET_KEY);
    req.userId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

router.post("/", authenticate, (req, res) => {
  const { targetId } = req.body;
  const followerId = req.userId;

  if (!targetId) {
    return res.status(400).json({ error: "targetId obrigatório" });
  }

  if (followerId === targetId) {
    return res.status(400).json({ error: "Não é possível seguir a si mesmo" });
  }

  db.get(
    `SELECT 1 FROM followers WHERE follower_id = ? AND followed_id = ?`,
    [followerId, targetId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Erro no banco de dados" });

      if (row) {
        db.run(
          `DELETE FROM followers WHERE follower_id = ? AND followed_id = ?`,
          [followerId, targetId],
          function (err) {
            if (err) return res.status(500).json({ error: "Erro no banco de dados" });
            return res.json({ success: true, action: "unfollowed", targetId });
          }
        );
      } else {
        db.run(
          `INSERT INTO followers (follower_id, followed_id) VALUES (?, ?)`,
          [followerId, targetId],
          function (err) {
            if (err) return res.status(500).json({ error: "Erro no banco de dados" });
            return res.status(201).json({ success: true, action: "followed", targetId });
          }
        );
      }
    }
  );
});

router.get("/:id/followers", (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT u.id, u.username, u.profile_picture 
     FROM followers f
     JOIN users u ON f.follower_id = u.id
     WHERE f.followed_id = ?`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Erro no banco de dados" });
      res.json(rows);
    }
  );
});

router.get("/:id/following", (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT u.id, u.username, u.profile_picture 
     FROM followers f
     JOIN users u ON f.followed_id = u.id
     WHERE f.follower_id = ?`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Erro no banco de dados" });
      res.json(rows);
    }
  );
});

module.exports = router;
