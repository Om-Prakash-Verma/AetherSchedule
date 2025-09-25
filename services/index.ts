import * as realApi from './apiService';

// This application is now configured to always use the real API service.
// The mock service has been removed to ensure connection to the real-time database
// during both development and production.
export const {
    login,
    getAllData,
    runScheduler,
    saveTimetable,
    updateTimetable,
    saveTimetableFeedback,
    saveSubject,
    deleteSubject,
    saveFaculty,
    deleteFaculty,
    saveRoom,
    deleteRoom,
    saveBatch,
    deleteBatch,
    saveDepartment,
    deleteDepartment,
    saveUser,
    deleteUser,
    savePinnedAssignment,
    deletePinnedAssignment,
    savePlannedLeave,
    deletePlannedLeave,
    saveFacultyAvailability,
    saveGlobalConstraints,
    resetData,
} = realApi;