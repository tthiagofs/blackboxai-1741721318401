// Event listener for form submission
document.getElementById('appLoginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === '@admin' && password === '134679') {
        console.log('Login bem-sucedido');
        showScreen('reportSelectionScreen');
    } else {
        console.log('Login falhou');
        const errorDiv = document.getElementById('appLoginError');
        errorDiv.classList.remove('hidden');
        errorDiv.querySelector('.error-text').textContent = 'Usuário ou senha inválidos.';
    }
});

// Function to show/hide screens
function showScreen(screenId) {
    console.log('Alternando para a tela:', screenId);
    const screens = ['appLoginScreen', 'reportSelectionScreen', 'loginScreen', 'mainContent'];
    screens.forEach(screen => {
        const element = document.getElementById(screen);
        if (element) {
            element.style.display = screen === screenId ? 'block' : 'none';
        }
    });
    console.log('Tela atualizada com sucesso:', screenId);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Mostrando tela de login inicial');
    showScreen('appLoginScreen');
});
