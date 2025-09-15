const express = require("express");
const app = express();
const PORT = 8008;

const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");

app.use(express.json());
app.use("/users", userRoutes);
app.use("/posts", postRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
