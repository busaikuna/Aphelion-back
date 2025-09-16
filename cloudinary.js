const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: "dl3arbevw",
    api_key: "723593252866551",
    api_secret: "oL-6TOphRfASvR_adwDpmTxfEJA"
});

module.exports = cloudinary;