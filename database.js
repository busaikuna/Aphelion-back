const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./aphelion.db", (err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
  } else {
    console.log("Connected to SQLite!");
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      address TEXT,
      profile_picture TEXT,
      banner_picture TEXT,
      website TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
      post_id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      description TEXT,
      content TEXT NOT NULL CHECK(length(content) <= 280),
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
      comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      followed_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(followed_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(follower_id, followed_id)
  )`);

  db.run("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)");
  db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
  db.run("CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_followers_followed ON followers(followed_id)");
});

module.exports = db;
