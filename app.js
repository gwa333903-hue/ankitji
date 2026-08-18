import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, getCountFromServer, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAG4RJ1YV4F2mRUcdxzWI5kVY1ErtGATv4",
  authDomain: "classn-12.firebaseapp.com",
  projectId: "classn-12",
  storageBucket: "classn-12.firebasestorage.app",
  messagingSenderId: "165777497789",
  appId: "1:165777497789:web:2cf437815dc4639bcd21d4",
};

const ADMIN_EMAIL = "gwa333903@gmail.com"; 

// ==========================================
// 2. INITIALIZATION & HELPERS
// ==========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null; 

// Helper function to compress and convert images to Base64
function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 200; 
                let width = img.width;
                let height = img.height;
                
                if (width > height && width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); 
            };
        };
    });
}

// ==========================================
// 3. AUTHENTICATION & ROUTING
// ==========================================
onAuthStateChanged(auth, async (user) => {
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (user) {
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
            if (!isIndex) { window.location.href = 'index.html'; return; }
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('profile-section').classList.remove('hidden');
            document.getElementById('p-name').value = user.displayName || '';
        }
        setupLogout();

    } else {
        if (!isIndex) window.location.href = 'index.html';
    }
});

const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(err => alert("Login failed: " + err.message));
    });
}

const emailAuthForm = document.getElementById('email-auth-form');

if (emailAuthForm) {
    emailAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                } catch (signupErr) {
                    if (signupErr.code === 'auth/email-already-in-use') {
                        alert("Incorrect password for existing account.");
                    } else {
                        alert("Sign up failed: " + signupErr.message);
                    }
                }
            } else {
                alert("Login failed: " + err.message);
            }
        }
    });
}

const profileForm = document.getElementById('profile-form');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        
        try {
            const picFile = document.getElementById('p-pic').files[0];
            let photoBase64 = "";
            if (picFile) {
                photoBase64 = await processImage(picFile);
            }

            await setDoc(doc(db, "users", user.uid), {
                name: document.getElementById('p-name').value,
                email: user.email,
                dob: document.getElementById('p-dob').value,
                course: document.getElementById('p-course').value,
                section: document.getElementById('p-section').value,
                rollNumber: document.getElementById('p-roll').value,
                photoURL: photoBase64,
                favorites: [] 
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
    try {
        const usersCol = collection(db, "users");
        const snapshot = await getCountFromServer(usersCol);
        document.getElementById('total-users').innerText = snapshot.data().count;
    } catch (e) { console.error("Error fetching user count", e); }

    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const fileInput = document.getElementById('file-input');
    const btnUpload = document.getElementById('btn-upload');

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) return;

        const customNameInput = document.getElementById('custom-file-name').value.trim();
        const selectedCourse = document.getElementById('upload-course').value;
        const finalFileName = customNameInput !== "" ? customNameInput : file.name;

        btnUpload.disabled = true;
        uploadStatus.innerText = "Converting and uploading securely... please wait.";
        uploadStatus.style.color = "black";

        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onloadend = async () => {
            try {
                const base64Content = reader.result.split(',')[1];
                const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `class_notes/${Date.now()}_${safeFileName}`;
                
                const backendResponse = await fetch('/api/upload', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        filename: filePath,
                        originalName: file.name,
                        content: base64Content
                    })
                });

                const backendData = await backendResponse.json();

                if (!backendResponse.ok) {
                    throw new Error(backendData.error || "Backend rejected the upload.");
                }

                const fileUrl = backendData.fileUrl;

                await addDoc(collection(db, "class_notes"), {
                    fileName: finalFileName,
                    originalName: file.name,
                    course: selectedCourse,
                    fileUrl: fileUrl,
                    uploadedAt: serverTimestamp(),
                    uploaderEmail: auth.currentUser.email
                });

                uploadStatus.innerText = "Success! File uploaded securely.";
                uploadStatus.style.color = "green";
                uploadForm.reset();
                
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
                    <td>${data.fileName} <br><small style="color:gray;">(${data.course || 'All'})</small></td>
                    <td>${timeString}</td>
                    <td>
                        <button class="btn btn-secondary btn-edit" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; width: auto; margin-right: 5px;">Edit Name</button>
                        <button class="btn btn-delete" style="background: #dc2626; padding: 0.3rem 0.6rem; font-size: 0.8rem; width: auto;">Delete</button>
                    </td>
                `;
                
                tr.querySelector('.btn-edit').addEventListener('click', async () => {
                    const newName = prompt("Enter new file name:", data.fileName);
                    if (newName && newName.trim() !== "" && newName.trim() !== data.fileName) {
                        try {
                            await updateDoc(doc(db, "class_notes", docId), {
                                fileName: newName.trim()
                            });
                            loadManageFiles(); 
                        } catch (err) {
                            alert("Error updating file name: " + err.message);
                        }
                    }
                });

                tr.querySelector('.btn-delete').addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to remove "${data.fileName}" from the student portal?`)) {
                        try {
                            await deleteDoc(doc(db, "class_notes", docId));
                            loadManageFiles(); 
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

    loadManageFiles();
}

// ==========================================
// 5. STUDENT DASHBOARD LOGIC (student.html)
// ==========================================
async function initStudentDashboard() {
    document.getElementById('student-welcome-text').innerText = `Welcome, ${currentUserData.name} (Roll: ${currentUserData.rollNumber})`;
    
    const profileImg = document.getElementById('student-profile-img');
    
    // Check if the user has a photoURL. If not, fallback to the default image.
    if (currentUserData.photoURL) {
        profileImg.src = currentUserData.photoURL;
    } else {
        profileImg.src = "image.png"; 
    }
    profileImg.classList.remove('hidden');

    // Make the profile picture clickable to open edit modal
    profileImg.addEventListener('click', () => {
        const btnEditProfile = document.getElementById('btn-edit-profile');
        if (btnEditProfile) {
            btnEditProfile.click();
        }
    });
    
    // --- Edit Profile Logic ---
    const editProfileModal = document.getElementById('edit-profile-modal');
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const editProfileForm = document.getElementById('edit-profile-form');

    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', () => {
            document.getElementById('edit-name').value = currentUserData.name || '';
            document.getElementById('edit-dob').value = currentUserData.dob || ''; 
            document.getElementById('edit-course').value = currentUserData.course || '';
            document.getElementById('edit-section').value = currentUserData.section || '';
            document.getElementById('edit-roll').value = currentUserData.rollNumber || '';
            document.getElementById('edit-pic').value = ""; 
            
            editProfileModal.classList.remove('hidden');
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            editProfileModal.classList.add('hidden');
        });
    }

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = editProfileForm.querySelector('button[type="submit"]');
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Updating...";

            try {
                const newName = document.getElementById('edit-name').value;
                const newDob = document.getElementById('edit-dob').value;
                const newCourse = document.getElementById('edit-course').value;
                
                const picFile = document.getElementById('edit-pic').files[0];
                let finalPhotoURL = currentUserData.photoURL; 
                if (picFile) {
                    finalPhotoURL = await processImage(picFile);
                }

                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    name: newName,
                    dob: newDob,
                    course: newCourse,
                    photoURL: finalPhotoURL
                });

                currentUserData.name = newName;
                currentUserData.dob = newDob;
                currentUserData.course = newCourse;
                currentUserData.photoURL = finalPhotoURL;
                
                document.getElementById('student-welcome-text').innerText = `Welcome, ${currentUserData.name} (Roll: ${currentUserData.rollNumber})`;
                
                if (finalPhotoURL) {
                    profileImg.src = finalPhotoURL;
                } else {
                    profileImg.src = "image_84edc6.png"; 
                }
                
                alert("Profile updated successfully!");
                editProfileModal.classList.add('hidden');
                location.reload(); 
            } catch (error) {
                alert("Error updating profile: " + error.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Update Profile";
            }
        });
    }

    // --- Search, Filter, and Favorites Logic ---
    let allNotes = [];
    let showingFavorites = false;

    if (!currentUserData.favorites) {
        currentUserData.favorites = [];
    }

    const container = document.getElementById('notes-container');
    const searchInput = document.getElementById('search-input');
    const btnToggleFavs = document.getElementById('btn-toggle-favs');

    function renderNotes() {
        container.innerHTML = '';
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        const filteredNotes = allNotes.filter(note => {
            const matchesCourse = note.course === currentUserData.course; 
            const matchesSearch = note.fileName.toLowerCase().includes(searchTerm);
            const matchesFav = showingFavorites ? currentUserData.favorites.includes(note.id) : true;
            
            return matchesCourse && matchesSearch && matchesFav;
        });

        if (filteredNotes.length === 0) {
            container.innerHTML = '<p>No notes found.</p>';
            return;
        }

        filteredNotes.forEach((note) => {
            const dateStr = note.uploadedAt ? note.uploadedAt.toDate().toLocaleDateString() : 'Recently';
            const isFav = currentUserData.favorites.includes(note.id);
            
            const card = document.createElement('div');
            card.className = 'note-card';
            card.innerHTML = `
                <div class="note-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="note-title" style="font-weight: 600; margin-bottom: 0.5rem; word-break: break-all;">${note.fileName}</div>
                    <button class="star-btn ${isFav ? 'active' : ''}" data-id="${note.id}" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: ${isFav ? '#fbbf24' : '#cbd5e1'};">
                        ★
                    </button>
                </div>
                <div class="note-date" style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">Uploaded: ${dateStr}</div>
                <div class="note-actions" style="display: flex; gap: 0.5rem; margin-top: auto;">
                    <button class="btn btn-secondary btn-preview" style="padding: 0.5rem; font-size: 0.9rem;">Preview</button>
                    <button class="btn btn-download" style="padding: 0.5rem; font-size: 0.9rem;">Download</button>
                </div>
            `;

            const starBtn = card.querySelector('.star-btn');
            starBtn.addEventListener('click', async () => {
                const noteId = note.id;
                
                if (currentUserData.favorites.includes(noteId)) {
                    currentUserData.favorites = currentUserData.favorites.filter(id => id !== noteId);
                } else {
                    currentUserData.favorites.push(noteId);
                }
                
                try {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), {
                        favorites: currentUserData.favorites
                    });
                    renderNotes(); 
                } catch (err) {
                    alert("Error updating favorite: " + err.message);
                }
            });

            card.querySelector('.btn-preview').addEventListener('click', () => {
                window.open(note.fileUrl, '_blank');
            });

            card.querySelector('.btn-download').addEventListener('click', async (e) => {
                const btn = e.target;
                btn.innerText = "Loading...";
                btn.disabled = true;

                try {
                    await addDoc(collection(db, "download_logs"), {
                        rollNumber: currentUserData.rollNumber,
                        studentName: currentUserData.name,
                        fileName: note.fileName,
                        downloadedAt: serverTimestamp()
                    });

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
                    window.open(note.fileUrl, '_blank'); 
                } finally {
                    btn.innerText = "Download";
                    btn.disabled = false;
                }
            });

            container.appendChild(card);
        });
    }

    try {
        const notesRef = collection(db, "class_notes");
        const q = query(notesRef, orderBy("uploadedAt", "desc"));
        const snapshot = await getDocs(q);
        
        snapshot.forEach((docSnap) => {
            allNotes.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        renderNotes();
    } catch (error) {
        console.error("Error loading notes: ", error);
        container.innerHTML = '<p style="color:red">Failed to load notes.</p>';
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderNotes);
    }

    if (btnToggleFavs) {
        btnToggleFavs.addEventListener('click', () => {
            showingFavorites = !showingFavorites;
            btnToggleFavs.innerText = showingFavorites ? "🌟 Show All Notes" : "⭐ Show Favorites";
            renderNotes();
        });
    }
}