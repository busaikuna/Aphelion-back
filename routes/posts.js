const express = require("express");
const cloudinary = require("../cloudinary");
const jwt = require("jsonwebtoken")
const { SECRET_KEY } = require("../config")

const db = require("../database");
const router = express.Router();

router.post("/", async (req, res) => {
  const { token, description, content } = req.body;
  if (!token || !content) return res.status(401).json({ error: "Access Token and Content required" });

  let author_id;
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    author_id = payload.id;
  } catch (err) {
    return res.status(401).json({ error: "Invalid Access Token" });
  }

  db.get(`SELECT * FROM users WHERE id = ?`, [author_id], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: "Author not found" });

    let pictureUrl = '';

    if (req.files && req.files.picture) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(req.files.picture.tempFilePath, {
          folder: "posts",
        });
        pictureUrl = uploadResponse.secure_url;
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return res.status(500).json({ error: "Error uploading image" });
      }
    }


    db.run(
      `INSERT INTO posts (author_id, description, content, picture) VALUES (?, ?, ?, ?)`,
      [author_id, description || "", content, pictureUrl],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          post_id: this.lastID,
          author_id,
          description,
          content,
          picture: pictureUrl
        });
      }
    );
  });
});


router.get("/", (req, res) => {
  db.all(
    `SELECT 
        p.post_id, 
        u.user_tag, 
        u.username, 
        u.profile_picture,
        p.description, 
        p.content, 
        p.picture, 
        p.created_at
     FROM posts p
     JOIN users u ON p.author_id = u.id
     ORDER BY p.created_at DESC;
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});


router.post("/comments", (req, res) => {
  const { post_id, user_id, comment } = req.body;
  if (!post_id || !user_id || !comment) return res.status(400).json({ error: "All fields required" });

  db.get(`SELECT * FROM posts WHERE post_id = ?`, [post_id], (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!post) return res.status(400).json({ error: "Post not found" });

    db.get(`SELECT * FROM users WHERE id = ?`, [user_id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(400).json({ error: "User not found" });

      db.run(
        `INSERT INTO comments (post_id, user_id, comment) VALUES (?, ?, ?)`,
        [post_id, user_id, comment],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ comment_id: this.lastID, post_id, user_id, comment });
        }
      );
    });
  });
});

router.get("/:post_id/comments", (req, res) => {
  const { post_id } = req.params;
  db.all(
    `SELECT c.comment_id, c.post_id, c.user_id, u.username, c.comment, c.created_at
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [post_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

module.exports = router;
