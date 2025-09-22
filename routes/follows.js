const express = require("express");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");
const db = require("../database");

const router = express.Router();

function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Token obrigatório" });
  }

  try {
    const payload = jwt.verify(authHeader.replace("Bearer ", ""), SECRET_KEY);
    req.userTag = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}


router.post("/", authenticate, (req, res) => {
  const { targetTag } = req.body;
  const followerId = req.userTag;

  if (!targetTag) {
    return res.status(400).json({ error: "targetTag obrigatório" });
  }

  db.get(
    `SELECT id FROM users WHERE user_tag = ?`,
    [targetTag],
    (err, userRow) => {
      if (err) return res.status(500).json({ error: "Erro no banco de dados" });
      if (!userRow) return res.status(404).json({ error: "Usuário alvo não encontrado" });

      const targetId = userRow.id;

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
                return res.json({ success: true, action: "unfollowed", targetTag });
              }
            );
          } else {
            db.run(
              `INSERT INTO followers (follower_id, followed_id) VALUES (?, ?)`,
              [followerId, targetId],
              function (err) {
                if (err) return res.status(500).json({ error: "Erro no banco de dados" });
                return res.status(201).json({ success: true, action: "followed", targetTag });
              }
            );
          }
        }
      );
    }
  );
});

router.get("/check", authenticate, (req, res) => {
  const { targetTag } = req.query;
  const followerId = req.userTag;

  if (!targetTag) {
    return res.status(400).json({ error: "targetTag obrigatório" });
  }

  db.get(
    `SELECT id FROM users WHERE user_tag = ?`,
    [targetTag],
    (err, userRow) => {
      if (err) return res.status(500).json({ error: "Erro no banco de dados" });
      if (!userRow) return res.status(404).json({ error: "Usuário alvo não encontrado" });

      const targetId = userRow.id;

      db.get(
        `SELECT 1 FROM followers WHERE follower_id = ? AND followed_id = ?`,
        [followerId, targetId],
        (err, row) => {
          if (err) return res.status(500).json({ error: "Erro no banco de dados" });

          if (row) {
            return res.json({ follows: true, targetTag });
          } else {
            return res.json({ follows: false, targetTag });
          }
        }
      );
    }
  );
});

router.get("/infoFollows", authenticate, (req, res) => {
    const { userTag } = req.query;

    if (!userTag) {
        return res.status(400).json({ error: "userTag obrigatório" });
    }

    db.get(
        `SELECT id FROM users WHERE user_tag = ?`,
        [userTag],
        (err, userRow) => {
            if (err) return res.status(500).json({ error: "Erro no banco de dados" });
            if (!userRow) return res.status(404).json({ error: "Usuário não encontrado" });

            const userId = userRow.id;

            db.get(
                `SELECT COUNT(*) AS followersCount FROM followers WHERE followed_id = ?`,
                [userId],
                (err, followersRow) => {
                    if (err) return res.status(500).json({ error: "Erro ao contar seguidores" });
                    db.get(
                        `SELECT COUNT(*) AS followingCount FROM followers WHERE follower_id = ?`,
                        [userId],
                        (err, followingRow) => {
                            if (err) return res.status(500).json({ error: "Erro ao contar seguindo" });

                            res.json({
                                followersCount: followersRow.followersCount,
                                followingCount: followingRow.followingCount
                            });
                        }
                    );
                }
            );
        }
    );
});


router.get("/:tag/followers", (req, res) => {
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

router.get("/:tag/following", (req, res) => {
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
