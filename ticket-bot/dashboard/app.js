const fields = [
  'token',
  'clientId',
  'guildId',
  'supportRoleId',
  'frpCategoryId',
  'vipCategoryId',
  'gangCategoryId',
  'factionCategoryId',
  'transcriptChannelId',
];

const envOutput = document.getElementById('envOutput');

function getValues() {
  return Object.fromEntries(fields.map((id) => [id, document.getElementById(id).value.trim()]));
}

function createEnv(values) {
  return [
    `DISCORD_TOKEN=${values.token}`,
    `DISCORD_CLIENT_ID=${values.clientId}`,
    `DISCORD_GUILD_ID=${values.guildId}`,
    '',
    `SUPPORT_ROLE_ID=${values.supportRoleId}`,
    `FRP_CATEGORY_ID=${values.frpCategoryId}`,
    `VIP_CATEGORY_ID=${values.vipCategoryId}`,
    `GANG_APPLY_CATEGORY_ID=${values.gangCategoryId}`,
    `FACTION_APPLY_CATEGORY_ID=${values.factionCategoryId}`,
    `TRANSCRIPT_CHANNEL_ID=${values.transcriptChannelId}`,
  ].join('\n');
}

function saveLocal() {
  localStorage.setItem('tickettool-dashboard', JSON.stringify(getValues()));
}

function loadLocal() {
  const saved = localStorage.getItem('tickettool-dashboard');
  if (!saved) return;
  const values = JSON.parse(saved);
  for (const id of fields) {
    if (values[id] !== undefined) {
      document.getElementById(id).value = values[id];
    }
  }
}

document.getElementById('saveBtn').addEventListener('click', () => {
  saveLocal();
  alert('Saved locally in browser storage.');
});

document.getElementById('envBtn').addEventListener('click', () => {
  envOutput.value = createEnv(getValues());
});

document.getElementById('copyBtn').addEventListener('click', async () => {
  if (!envOutput.value) {
    envOutput.value = createEnv(getValues());
  }
  await navigator.clipboard.writeText(envOutput.value);
  alert('.env copied to clipboard');
});

loadLocal();
envOutput.value = createEnv(getValues());
