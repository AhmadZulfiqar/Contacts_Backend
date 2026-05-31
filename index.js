const express = require('express');
const path = require('path'); 
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cors = require('cors');
const mongoose = require('mongoose');
const contact = require('./models/schema'); 
const multer = require('multer');
const fs = require('fs');
const dns = require('dns');

// 🛠️ VERCEL READ-ONLY SYSTEM FIX: Use serverless OS temp directory
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => { 
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
dns.setServers(['1.1.1.1', "8.8.8.8"]);

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
app.use('/uploads', express.static(uploadDir));
app.use(express.json());

// ⚡ SERVERLESS OPTIMIZATION: Cache the database connection pool across function calls
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }
  
  console.log("Connecting to MongoDB Atlas...");
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Stop hanging if connection fails
    });
    isConnected = db.connections[0].readyState === 1;
    console.log("Connected to DB cleanly.");
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
};

// GET ALL CONTACTS
app.get('/contacts', async (req, res) => {
  try {
    await connectDB(); // Ensure DB connection is ready
    const allContacts = await contact.find();
    res.json(allContacts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch", details: err.message });
  }
});

// UNIVERSAL API ROOT ROUTE
app.get('/', (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Contact API Server is live and running smoothly!"
  });
});

// ADD CONTACT
app.post('/add-contact', upload.single('img'), async (req, res) => {
  try {
    await connectDB(); // Ensure DB connection is ready before trying to save
    
    console.log("Body:", req.body);
    console.log("File:", req.file);

    const newContact = new contact({
      name: req.body.name,
      phone: req.body.phone,
      img: req.file ? `/uploads/${path.basename(req.file.path)}` : ""
    });

    await newContact.save();
    res.status(201).json(newContact);
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ error: "Upload failed", message: err.message });
  }
});

// GET SINGLE CONTACT
app.get('/contacts/:id', async (req, res) => {
  try {
    await connectDB();
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
    await connectDB();
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
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// DELETE CONTACT
app.delete('/delete-contact/:id', async (req, res) => {
  try {
    await connectDB();
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
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;