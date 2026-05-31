const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  img: { type: String } // Store image as URL or Base64 string
});

module.exports = mongoose.model('Contact', contactSchema);