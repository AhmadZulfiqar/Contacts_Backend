const express = require('express');
require('dotenv').config();
const cors = require('cors');
const mongoose = require('mongoose');
const contact = require('./models/schema'); 
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const dns = require('dns');

// 🛠️ FIX FOR VERCEL READ-ONLY SYSTEM: Use serverless OS temp directory
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => { 
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    // Save file with timestamp to avoid name conflicts
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
dns.setServers(['1.1.1.1', "8.8.8.8"]);

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
// Expose the temporary uploads directory over the web path
app.use('/uploads', express.static(uploadDir));
app.use(express.json()); // This parses JSON bodies

// DATABASE CONNECTION
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to DB"))
  .catch(err => console.log(err));

// GET ALL CONTACTS
app.get('/contacts', async (req, res) => {
  try {
    const allContacts = await contact.find();
    res.json(allContacts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// UNIVERSAL API ROOT ROUTE
app.get('/', (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Contact API Server is live and running smoothly!",
    timestamp: new Date(),
    endpoints: {
      getAllContacts: "/contacts (GET)",
      addContact: "/add-contact (POST)",
      getSingleContact: "/contacts/:id (GET)",
      updateContact: "/update-contact/:id (PUT)",
      deleteContact: "/delete-contact/:id (DELETE)"
    }
  });
});

// ADD CONTACT
app.post('/add-contact', upload.single('img'), async (req, res) => {
  try {
    const newContact = new contact({
      name: req.body.name,
      phone: req.body.phone,
      // We rewrite the string path so the frontend can still call /uploads/filename
      img: req.file ? `/uploads/${path.basename(req.file.path)}` : "" 
    });
    await newContact.save();
    console.log("New contact added:", newContact);
    res.status(201).json(newContact);
  } catch (err) {
    console.error("Add Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// GET SINGLE CONTACT
app.get('/contacts/:id', async (req, res) => {
  try {
    const contactData = await contact.findById(req.params.id);  
    if (!contactData) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json(contactData);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

// UPDATE CONTACT
app.put('/update-contact/:id', upload.single('img'), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      phone: req.body.phone
    };

    if (req.file) {
      updateData.img = `/uploads/${path.basename(req.file.path)}`;
    }

    const updatedContact = await contact.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );

    if (!updatedContact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json(updatedContact);
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// DELETE CONTACT
app.delete('/delete-contact/:id', async (req, res) => {
  try {
    const deletedContact = await contact.findByIdAndDelete(req.params.id);
    if (!deletedContact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    if (deletedContact.img) {
      const fileName = path.basename(deletedContact.img);
      const fullPath = path.join(uploadDir, fileName);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;