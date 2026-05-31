const express = require('express');
require('dotenv').config();
const cors = require('cors');
const mongoose = require('mongoose');
const contact = require('./models/schema'); 
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const dns = require('dns');

const storage = multer.diskStorage({
  destination: (req, file, cb) => { 
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    // Save file with timestamp to avoid name conflicts
    cb(null, Date.now() + path.extname(file.originalname));
  }
})
const upload = multer({ storage: storage });
dns.setServers(['1.1.1.1',"8.8.8.8"]);

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
app.use('/uploads', express.static('uploads'));
app.use(express.json()); // This parses JSON bodies

// DATABASE CONNECTION
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

// ADD CONTACT (Modified to remove Multer)
app.post('/add-contact', upload.single('img'), async (req, res) => {
  try {
    const newContact = new contact({
      name: req.body.name,
      phone: req.body.phone,
      img: req.file ? req.file.path.replace(/\\/g, "/") : "" 
    });
    await newContact.save();
    console.log("New contact added:", newContact);
    res.status(201).json(newContact);
  } catch (err) {
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
// 1. Add 'upload.single' here to handle the FormData
app.put('/update-contact/:id', upload.single('img'), async (req, res) => {
  try {
    // 2. Prepare the update object
    const updateData = {
      name: req.body.name,
      phone: req.body.phone
    };

    // 3. Check if a new image was uploaded
    if (req.file) {
      updateData.img = req.file.path.replace(/\\/g, "/");
    }

    // 4. Update the document
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

    // Simple check: if it has an image, delete it from the folder
    if (deletedContact.img && fs.existsSync(deletedContact.img)) {
      fs.unlinkSync(deletedContact.img);
    }

    res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;