const startwatch = document.getElementById("startwatch");
const audienceSection = document.getElementById("audienceSection");
const roleSelection = document.getElementById("roleSelection");



document.addEventListener("DOMContentLoaded", () => {
    startwatch.addEventListener("click", () => {
        // 隱藏角色選擇區，顯示 Audience 區域
        roleSelection.style.display = "none";
        audienceSection.style.display = "block";
    });
});