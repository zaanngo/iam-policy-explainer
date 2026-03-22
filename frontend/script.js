const BACKEND_URL = 'http://98.86.92.213:5000';

const samples = {
    admin: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}`,
    s3: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ]
    }
  ]
}`,
    ec2: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ec2:*",
      "Resource": "*"
    }
  ]
}`
};

function toggleDark() {
    document.body.classList.toggle('dark');
    const btn = document.querySelector('.dark-toggle');
    btn.textContent = document.body.classList.contains('dark') ? 'Light Mode' : 'Dark Mode';
}

function loadSample(name) {
    document.getElementById('policy-input').value = samples[name];
}

function clearAll() {
    document.getElementById('policy-input').value = '';
    document.getElementById('result').style.display = 'none';
    document.getElementById('placeholder').style.display = 'flex';
    document.getElementById('error-box').style.display = 'none';
    document.getElementById('error-box').textContent = '';
}

function showError(msg) {
    const box = document.getElementById('error-box');
    box.textContent = msg;
    box.style.display = 'block';
}

function hideError() {
    const box = document.getElementById('error-box');
    box.style.display = 'none';
    box.textContent = '';
}

function copyHardened() {
    const text = document.getElementById('hardened-output').textContent;
    
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.copy-btn');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
        });
    } else {
        // Fallback for HTTP
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    }
}

async function explainPolicy() {
    const input = document.getElementById('policy-input').value.trim();
    const btn = document.getElementById('explain-btn');

    hideError();

    if (!input) {
        showError('Please paste an IAM policy first.');
        return;
    }

    try {
        JSON.parse(input);
    } catch (e) {
        showError('Invalid JSON. Check for missing brackets, commas, or quotes.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    document.getElementById('result').style.display = 'none';
    document.getElementById('placeholder').style.display = 'flex';

    try {
        const response = await fetch(`${BACKEND_URL}/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policy: input })
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Something went wrong.');
            return;
        }

        document.getElementById('summary').textContent = data.summary;

        const badge = document.getElementById('severity-badge');
        badge.textContent = data.severity === 'high' ? 'High Risk' : 'Low Risk';
        badge.className = `badge ${data.severity}`;

        const risksList = document.getElementById('risks-list');
        risksList.innerHTML = '';
        (data.risks || []).forEach(risk => {
            const li = document.createElement('li');
            li.textContent = risk;
            risksList.appendChild(li);
        });

        const recsList = document.getElementById('recs-list');
        recsList.innerHTML = '';
        (data.recommendations || []).forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recsList.appendChild(li);
        });

        if (data.hardened_policy) {
            document.getElementById('hardened-output').textContent = 
                JSON.stringify(data.hardened_policy, null, 2);
        }

        document.getElementById('placeholder').style.display = 'none';
        document.getElementById('result').style.display = 'block';

    } catch (err) {
        showError('Could not reach the server. Is your backend running?');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Explain Policy';
    }
}
