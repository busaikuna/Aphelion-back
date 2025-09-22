const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")
const cloudinary = require("../cloudinary");
const db = require("../database");
const router = express.Router();

const { SECRET_KEY, REFRESH_SECRET_KEY } = require("../config")
const SALT_ROUNDS = 10;

router.get("/myProfile", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token" });

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, SECRET_KEY)

    db.get(`SELECT * FROM users WHERE id = ?`, [payload.id], async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(400).json({ success: false, message: "Invalid profile" });

      res.json({
        profile_username: user.username,
        profile_email: user.email,
        profile_tag: user.user_tag,
        profile_description: user.description,
        profile_address: user.address,
        profile_picture: user.profile_picture,
        profile_banner: user.banner_picture,
        profile_website: user.website,
        profile_createdAt: user.created_at
      });
    });
  } catch (error) {
    res.status(500).json({ error })
  }
})


router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields required" });

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    db.get(
      `SELECT user_tag FROM users WHERE username = ? ORDER BY id DESC LIMIT 1`,
      [username],
      function (err, row) {
        if (err) return res.status(500).json({ error: err.message });
        let newNumber = "0000";
        if (row && row.user_tag) {
          const lastTag = row.user_tag;
          const parts = lastTag.split("#");
          if (parts.length === 2) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num)) {
              newNumber = String(num + 1).padStart(4, "0");
            }
          }
        }

        const user_tag = `${username}#${newNumber}`;

        db.run(
          `INSERT INTO users (username, email, password, user_tag) VALUES (?, ?, ?, ?)`,
          [username, email, hashedPassword, user_tag],
          function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(201).json({ id: this.lastID, username, email, user_tag });
          }
        );
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
        secure: false,
        sameSite: "lax"
      })
      res.json({ accessToken });
    } else {
      res.json({ success: false, message: "Senha Incorreta" });
    }
  });
});

router.post("/refresh", (req, res) => {

  if (!req.cookies.refreshToken) {
    return res.status(401).send("Sem refresh token");
  }

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

router.put("/profile/edit", async (req, res) => {
  const { token, username, address, website, description } = req.body;
  if (!token) return res.status(401).json({ error: "Access token required" });

  let userId;
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    userId = payload.id;
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  db.get(`SELECT * FROM users WHERE id = ?`, [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: "User not found" });

    let profileUrl = user.profile_picture;
    let bannerUrl = user.banner_picture;

    if (req.files && req.files.profile_picture) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(
          req.files.profile_picture.tempFilePath,
          { folder: "profiles", transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }] }
        );
        profileUrl = uploadResponse.secure_url;
      } catch (err) {
        return res.status(500).json({ error: "Error uploading profile picture" });
      }
    }

    if (req.files && req.files.banner_picture) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(
          req.files.banner_picture.tempFilePath,
          { folder: "banners" }
        );
        bannerUrl = uploadResponse.secure_url;
      } catch (err) {
        return res.status(500).json({ error: "Error uploading banner picture" });
      }
    }

    const newUsername = username || user.username;
    let newUserTag = user.user_tag;

    if (newUsername !== user.username) {
      db.get(
        `SELECT user_tag FROM users WHERE username = ? ORDER BY id DESC LIMIT 1`,
        [newUsername],
        (err2, row) => {
          if (err2) return res.status(500).json({ error: err2.message });

          let newNumber = "0000";
          if (row && row.user_tag) {
            const parts = row.user_tag.split("#");
            if (parts.length === 2) {
              const num = parseInt(parts[1], 10);
              if (!isNaN(num)) {
                newNumber = String(num + 1).padStart(4, "0");
              }
            }
          }
          newUserTag = `${newUsername}#${newNumber}`;

          updateUser(newUsername, newUserTag);
        }
      );
    } else {
      updateUser(newUsername, newUserTag);
    }

    function updateUser(finalUsername, finalUserTag) {
      db.run(
        `UPDATE users 
         SET username = ?, 
             user_tag = ?,
             address = ?, 
             profile_picture = ?, 
             banner_picture = ?, 
             website = ?, 
             description = ?
         WHERE id = ?`,
        [
          finalUsername,
          finalUserTag,
          address || user.address,
          profileUrl,
          bannerUrl,
          website || user.website,
          description || user.description,
          userId
        ],
        function (err3) {
          if (err3) return res.status(500).json({ error: err3.message });

          db.get(
            `SELECT id, username, user_tag, email, address, profile_picture, banner_picture, website, description, created_at
             FROM users WHERE id = ?`,
            [userId],
            (err4, updatedUser) => {
              if (err4) return res.status(500).json({ error: err4.message });
              res.json({ success: true, user: updatedUser });
            }
          );
        }
      );
    }
  });
});

router.get("/anotherProfile/:tag", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token" });

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, SECRET_KEY);

    const userTag = req.params.tag;

    db.get(
      `SELECT * FROM users WHERE user_tag = ?`,
      [userTag],
      (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ success: false, message: "Usuário não encontrado" });

        res.json({
          profile_username: user.username,
          profile_tag: user.user_tag,
          profile_email: user.email,
          profile_description: user.description,
          profile_address: user.address,
          profile_picture: user.profile_picture,
          profile_banner: user.banner_picture,
          profile_website: user.website,
          profile_createdAt: user.created_at
        });
      }
    );
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});


router.get("/verifyToken", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ valid: false, error: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, SECRET_KEY);
    res.json({ valid: true });
  } catch (err) {
    res.status(401).json({ valid: false, error: "Invalid token" });
  }
});


module.exports = router;
