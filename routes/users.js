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
  console.log(token)
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

router.put("/profile/edit", async (req, res) => {
  const { token, username, address, website } = req.body;
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
          {
            folder: "profiles",
            transformation: [
              { width: 800, height: 800, crop: "limit", quality: "auto" }
            ]
          }
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

    console.log({
      username: username || user.username,
      address: address || user.address,
      profile_picture: profileUrl,
      banner_picture: bannerUrl,
      website: website || user.website,
    });

    db.run(
      `UPDATE users 
       SET username = ?, address = ?, profile_picture = ?, banner_picture = ?, website = ?
       WHERE id = ?`,
      [
        username || user.username,
        address || user.address,
        profileUrl,
        bannerUrl,
        website || user.website,
        userId
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        db.get(
          `SELECT id, username, email, address, profile_picture, banner_picture, website, created_at
           FROM users WHERE id = ?`,
          [userId],
          (err, updatedUser) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, user: updatedUser });
          }
        );
      }
    );
  });
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
