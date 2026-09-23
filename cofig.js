// ========== FIREBASE CONFIGURATION ==========
const firebaseConfig = {
    apiKey: "AIzaSyAD3xg3SZLQyv-Rf3rb4vw6-HVsZuZRD3E",
    authDomain: "jobsphere-ab925.firebaseapp.com",
    projectId: "jobsphere-ab925",
    storageBucket: "jobsphere-ab925.firebasestorage.app",
    messagingSenderId: "757724057808",
    appId: "1:757724057808:web:d46c8fbb78409abfef4ed5"
};

// ========== CLOUDINARY CONFIGURATION ==========
const CLOUDINARY_CONFIG = {
    cloudName: 'dsv4npqz3',
    uploadPreset: 'jobsphere_media',
    maxImageSize: 10485760, // 10MB
    maxVideoSize: 52428800   // 50MB
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable Firestore persistence
db.enablePersistence().catch(err => {
    if (err.code === 'failed-precondition') {
        console.log('Multiple tabs open, persistence disabled');
    } else if (err.code === 'unimplemented') {
        console.log('Browser doesn\'t support persistence');
    }
});