document.getElementById('uploadForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  const htmlLogin = document.getElementById('htmlLogin').value;
  const htmlPassword = document.getElementById('htmlPassword').value;
  const htmlForm = document.getElementById('htmlForm').value;
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) {
    alert('Por favor, selecione um arquivo.');
    return;
  }

  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = 'Processando...';

  try {

    const text = await file.text();

    const parsedData = parseFileContent(text).map(data => ({
      ...data,
      selectors: {
        html_login: htmlLogin,
        html_password: htmlPassword,
        html_form: htmlForm,
      }
    }));

    const batchSize = 5;
    const batches = Math.ceil(parsedData.length / batchSize);

    const allResults = [];

    for (let i = 0; i < batches; i++) {
      const batchData = parsedData.slice(i * batchSize, (i + 1) * batchSize);

      const response = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData),
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar os dados ao servidor.');
      }

      const results = await response.json();
      allResults.push(...results);
    }

    resultsContainer.innerHTML = '<h3>Resultados:</h3>';
    allResults.forEach(result => {
      const div = document.createElement('div');
      div.classList.add(result.status === 'success' ? 'success' : 'error');
      div.textContent = `${result.status.toUpperCase()} - ${result.login} (${result.url})`;
      resultsContainer.appendChild(div);
    });
  } catch (error) {
    resultsContainer.innerHTML = `<p class="error">Erro: ${error.message}</p>`;
  }
});


function parseFileContent(content) {
  const lines = content.split('\n');
  const parsedData = [];

  let currentData = {};
  for (const line of lines) {
    if (line.includes('URL:')) {
      currentData.url = line.split('URL:')[1].trim();
    } else if (line.includes('Login:')) {
      currentData.login = line.split('Login:')[1].trim();
    } else if (line.includes('Senha:')) {
      currentData.password = line.split('Senha:')[1].trim();
    } else if (line.includes('<========================================>')) {
      if (Object.keys(currentData).length === 3) {
        parsedData.push(currentData);
      }
      currentData = {};
    }
  }
  return parsedData;
}
