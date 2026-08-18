import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, getCountFromServer, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. CONFIGURATION (FILL THESE IN!)
// ==========================================

// Your Firebase Config (From Project Settings)
const firebaseConfig = {
  apiKey: "AIzaSyAG4RJ1YV4F2mRUcdxzWI5kVY1ErtGATv4",
  authDomain: "classn-12.firebaseapp.com",
  projectId: "classn-12",
  storageBucket: "classn-12.firebasestorage.app",
  messagingSenderId: "165777497789",
  appId: "1:165777497789:web:2cf437815dc4639bcd21d4",
};

// Admin & GitHub Settings
const ADMIN_EMAIL = "gwa333903@gmail.com"; // Your actual Google email

const GITHUB_USERNAME = "gwa333903-hue"; 
const GITHUB_REPO = "class"; 
const GITHUB_TOKEN = process.env.G_TOKEN; // Your Fine-Grained PAT

// ==========================================
// 2. INITIALIZATION
// ==========================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null; // Caches student profile data

// ==========================================
// 3. AUTHENTICATION & ROUTING
// ==========================================
onAuthStateChanged(auth, async (user) => {
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (user) {
        // Admin Routing Check
        if (user.email === ADMIN_EMAIL) {
            if (isIndex || window.location.pathname.includes('student.html')) {
                window.location.href = 'admin.html';
                return;
            }
            if (document.getElementById('admin-page')) {
                document.getElementById('admin-page').classList.remove('hidden');
                initAdminDashboard();
            }
            setupLogout();
            return;
        }

        // Student Routing & Profile Check
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            if (isIndex || window.location.pathname.includes('admin.html')) {
                window.location.href = 'student.html';
            } else if (document.getElementById('student-page')) {
                document.getElementById('student-page').classList.remove('hidden');
                initStudentDashboard();
            }
        } else {
            // No profile -> show setup form on index.html
            if (!isIndex) { window.location.href = 'index.html'; return; }
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('profile-section').classList.remove('hidden');
            document.getElementById('p-name').value = user.displayName || '';
        }
        setupLogout();

    } else {
        // Not logged in -> push to index
        if (!isIndex) window.location.href = 'index.html';
    }
});

// Existing Google Login Button (index.html)
const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(err => alert("Login failed: " + err.message));
    });
}

// --- Email & Password Auth Logic ---
const emailAuthForm = document.getElementById('email-auth-form');
const btnEmailSignup = document.getElementById('btn-email-signup');

if (emailAuthForm) {
    // Handle Email Login
    emailAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            alert("Login failed: " + err.message);
        }
    });
}

if (btnEmailSignup) {
    // Handle Email Sign Up
    btnEmailSignup.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        if (!email || !password) {
            alert("Please enter both an email and password to sign up.");
            return;
        }
        
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) {
            alert("Sign up failed: " + err.message);
        }
    });
}

// Profile Setup Form (index.html)
const profileForm = document.getElementById('profile-form');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        
        try {
            await setDoc(doc(db, "users", user.uid), {
                name: document.getElementById('p-name').value,
                email: user.email,
                age: Number(document.getElementById('p-age').value),
                course: document.getElementById('p-course').value,
                section: document.getElementById('p-section').value,
                rollNumber: document.getElementById('p-roll').value,
            });
            window.location.href = 'student.html';
        } catch (error) {
            alert("Error saving profile: " + error.message);
        }
    });
}

function setupLogout() {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => signOut(auth));
    }
}

// ==========================================
// 4. ADMIN DASHBOARD LOGIC (admin.html)
// ==========================================
async function initAdminDashboard() {
    // 1. Fetch Total Users Analytics
    try {
        const usersCol = collection(db, "users");
        const snapshot = await getCountFromServer(usersCol);
        document.getElementById('total-users').innerText = snapshot.data().count;
    } catch (e) { console.error("Error fetching user count", e); }

    // 2. Upload Feature (GitHub API integration)
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const fileInput = document.getElementById('file-input');
    const btnUpload = document.getElementById('btn-upload');

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) return;

        btnUpload.disabled = true;
        uploadStatus.innerText = "Converting and uploading to GitHub... please wait.";
        uploadStatus.style.color = "black";

        // Convert file to Base64 for GitHub API
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onloadend = async () => {
            try {
                // Get the base64 string without the prefix
                const base64Content = reader.result.split(',')[1];
                
                // Create a unique, safe file path
                const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `class_notes/${Date.now()}_${safeFileName}`;
                
                const githubApiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;

                // Push file to GitHub
                const githubResponse = await fetch(githubApiUrl, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${GITHUB_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        message: `Admin upload: ${file.name}`,
                        content: base64Content
                    })
                });

                if (!githubResponse.ok) {
                    throw new Error("GitHub API rejected the upload. Check your token and repo name.");
                }

                const githubData = await githubResponse.json();
                const fileUrl = githubData.content.download_url;

                // Save metadata to Firestore
                await addDoc(collection(db, "class_notes"), {
                    fileName: file.name,
                    fileUrl: fileUrl,
                    uploadedAt: serverTimestamp(),
                    uploaderEmail: auth.currentUser.email
                });

                uploadStatus.innerText = "Success! File uploaded to GitHub & Firestore.";
                uploadStatus.style.color = "green";
                uploadForm.reset();
                
                // Refresh the file list immediately after a successful upload
                loadManageFiles(); 
                
            } catch (error) {
                uploadStatus.innerText = "Upload failed: " + error.message;
                uploadStatus.style.color = "red";
            } finally {
                btnUpload.disabled = false;
            }
        };
        
        reader.onerror = () => {
            uploadStatus.innerText = "Error reading file on your device.";
            uploadStatus.style.color = "red";
            btnUpload.disabled = false;
        };
    });

    // 3. Fetch Download Logs
    try {
        const logsRef = collection(db, "download_logs");
        const q = query(logsRef, orderBy("downloadedAt", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        
        const tbody = document.getElementById('logs-table-body');
        tbody.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const timeString = data.downloadedAt ? data.downloadedAt.toDate().toLocaleString() : 'Just now';
            tbody.innerHTML += `
                <tr>
                    <td>${timeString}</td>
                    <td>${data.rollNumber}</td>
                    <td>${data.studentName}</td>
                    <td>${data.fileName}</td>
                </tr>
            `;
        });
    } catch (e) { console.error("Error fetching logs", e); }

    // ==========================================
    // 4. Manage Uploaded Files List (Edit & Delete)
    // ==========================================
    async function loadManageFiles() {
        try {
            const notesRef = collection(db, "class_notes");
            const q = query(notesRef, orderBy("uploadedAt", "desc"));
            const querySnapshot = await getDocs(q);
            
            const tbody = document.getElementById('files-table-body');
            if(!tbody) return;
            tbody.innerHTML = '';
            
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const docId = docSnap.id;
                const timeString = data.uploadedAt ? data.uploadedAt.toDate().toLocaleDateString() : 'Recently';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${data.fileName}</td>
                    <td>${timeString}</td>
                    <td>
                        <button class="btn btn-secondary btn-edit" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; width: auto; margin-right: 5px;">Edit Name</button>
                        <button class="btn btn-delete" style="background: #dc2626; padding: 0.3rem 0.6rem; font-size: 0.8rem; width: auto;">Delete</button>
                    </td>
                `;
                
                // --- Edit File Name Event ---
                tr.querySelector('.btn-edit').addEventListener('click', async () => {
                    const newName = prompt("Enter new file name:", data.fileName);
                    // Check if input is valid and actually changed
                    if (newName && newName.trim() !== "" && newName.trim() !== data.fileName) {
                        try {
                            await updateDoc(doc(db, "class_notes", docId), {
                                fileName: newName.trim()
                            });
                            loadManageFiles(); // Refresh UI list
                        } catch (err) {
                            alert("Error updating file name: " + err.message);
                        }
                    }
                });

                // --- Delete File Event ---
                tr.querySelector('.btn-delete').addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to remove "${data.fileName}" from the student portal?`)) {
                        try {
                            // Removes document from Firestore (revoking portal access)
                            await deleteDoc(doc(db, "class_notes", docId));
                            loadManageFiles(); // Refresh UI list
                        } catch (err) {
                            alert("Error deleting file: " + err.message);
                        }
                    }
                });

                tbody.appendChild(tr);
            });
        } catch (e) { 
            console.error("Error fetching files for management", e); 
        }
    }

    // Trigger initial load on page boot
    loadManageFiles();
}

// ==========================================
// 5. STUDENT DASHBOARD LOGIC (student.html)
// ==========================================
async function initStudentDashboard() {
    document.getElementById('student-welcome-text').innerText = `Welcome, ${currentUserData.name} (Roll: ${currentUserData.rollNumber})`;
    
    try {
        const notesRef = collection(db, "class_notes");
        const q = query(notesRef, orderBy("uploadedAt", "desc"));
        const snapshot = await getDocs(q);
        
        const container = document.getElementById('notes-container');
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = '<p>No class notes available yet.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const note = docSnap.data();
            const dateStr = note.uploadedAt ? note.uploadedAt.toDate().toLocaleDateString() : 'Recently';
            
            const card = document.createElement('div');
            card.className = 'note-card';
            card.innerHTML = `
                <div class="note-title">${note.fileName}</div>
                <div class="note-date">Uploaded: ${dateStr}</div>
                <div class="note-actions">
                    <button class="btn btn-secondary btn-preview">Preview</button>
                    <button class="btn btn-download">Download</button>
                </div>
            `;

            // Preview Button
            card.querySelector('.btn-preview').addEventListener('click', () => {
                window.open(note.fileUrl, '_blank');
            });

            // Download Button (Tracks then downloads)
            card.querySelector('.btn-download').addEventListener('click', async (e) => {
                const btn = e.target;
                btn.innerText = "Loading...";
                btn.disabled = true;

                try {
                    // 1. Log the download in Firestore
                    await addDoc(collection(db, "download_logs"), {
                        rollNumber: currentUserData.rollNumber,
                        studentName: currentUserData.name,
                        fileName: note.fileName,
                        downloadedAt: serverTimestamp()
                    });

                    // 2. Trigger actual download
                    const response = await fetch(note.fileUrl);
                    const blob = await response.blob();
                    const objectUrl = window.URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = objectUrl;
                    a.download = note.fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(objectUrl);
                    a.remove();
                } catch (err) {
                    console.error(err);
                    // Fallback if fetch fails
                    window.open(note.fileUrl, '_blank'); 
                } finally {
                    btn.innerText = "Download";
                    btn.disabled = false;
                }
            });

            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading notes: ", error);
        document.getElementById('notes-container').innerHTML = '<p style="color:red">Failed to load notes.</p>';
    }
}