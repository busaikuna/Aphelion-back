const express = require("express");
const cors = require("cors")
const fileUpload = require("express-fileupload");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 8008;

const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");
const followsRoutes = require("./routes/follows");

app.use(cors({
  origin: "http://127.0.0.1:5501",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/" 
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/users", userRoutes);
app.use("/posts", postRoutes);
app.use("/follows", followsRoutes);
app.use(cookieParser());

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
