<script lang="ts">
  import { goto } from '$app/navigation';
  import { login } from '$lib/session';

  let user = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = '';
    try {
      await login(user, password);
      goto('/');
    } catch {
      error = 'Login failed - check your credentials and connection.';
    } finally {
      busy = false;
    }
  }
</script>

<form class="login" onsubmit={submit}>
  <h1>Travelstream</h1>
  <label>
    Username
    <input name="login" bind:value={user} autocomplete="username" required />
  </label>
  <label>
    Password
    <input
      name="password"
      type="password"
      bind:value={password}
      autocomplete="current-password"
      required
    />
  </label>
  {#if error}<p class="error">{error}</p>{/if}
  <button disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
</form>

<style>
  .login {
    max-width: 20rem;
    margin: 15dvh auto 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.9rem;
  }
  input {
    padding: 0.55rem;
    border: 1px solid #b8c0cc;
    border-radius: 6px;
    font-size: 1rem;
  }
  button {
    padding: 0.6rem;
    background: #1a3c5e;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
  }
  .error {
    color: #b3261e;
    font-size: 0.9rem;
  }
</style>
