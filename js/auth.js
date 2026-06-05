/* ───────────────────────────────────────────
   AARES — auth.js
   Registration, login, logout, session,
   password reset. No Supabase Auth — all
   handled manually via the accounts table.
─────────────────────────────────────────── */

const Auth = (() => {

  /* ── Session Helpers ── */

  function getSession() {
    try {
      const raw = localStorage.getItem(CONFIG.KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(user) {
    // Only store non-sensitive fields in localStorage
    const session = {
      id:            user.id,
      full_name:     user.full_name,
      mobile_number: user.mobile_number,
      email:         user.email || '',
      address:       user.address || '',
    };
    localStorage.setItem(CONFIG.KEYS.SESSION, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.KEYS.SESSION);
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function requireLogin(redirectTo = 'account.html') {
    if (!isLoggedIn()) {
      window.location.href = `${redirectTo}?redirect=${encodeURIComponent(window.location.href)}`;
      return false;
    }
    return true;
  }

  /* ── Register ── */

  async function register({
    full_name,
    mobile_number,
    email,
    password,
    address,
    security_question,
    security_answer,
  }) {
    // Validate
    if (!full_name?.trim())      throw new Error('Full name is required.');
    if (!isValidMobile(mobile_number)) throw new Error('Enter a valid Bangladeshi mobile number.');
    if (!isValidPassword(password))    throw new Error('Password must be at least 6 characters.');
    if (!security_question?.trim())    throw new Error('Please choose a security question.');
    if (!security_answer?.trim())      throw new Error('Security answer is required.');

    // Email validation if provided
    if (email && !isValidEmail(email)) throw new Error('Enter a valid email address.');

    // Check duplicates
    const mobileExists = await Accounts.mobileExists(mobile_number);
    if (mobileExists) throw new Error('This mobile number is already registered.');

    if (email) {
      const emailExists = await Accounts.emailExists(email);
      if (emailExists) throw new Error('This email is already registered.');
    }

    // Hash password and security answer
    const [hashedPassword, hashedAnswer] = await Promise.all([
      hashPassword(password),
      hashPassword(security_answer.toLowerCase().trim()),
    ]);

    // Create account
    const user = await Accounts.create({
      full_name:         full_name.trim(),
      mobile_number:     mobile_number.trim(),
      email:             email ? email.toLowerCase().trim() : null,
      password:          hashedPassword,
      address:           address?.trim() || null,
      security_question: security_question.trim(),
      security_answer:   hashedAnswer,
    });

    // Sync any guest cart that was in localStorage
    await Cart.syncGuestCartToSupabase(user.id);

    // Set session
    setSession(user);

    return user;
  }

  /* ── Login ── */

  async function login(credential, password) {
    if (!credential?.trim()) throw new Error('Enter your mobile number or email.');
    if (!password)           throw new Error('Enter your password.');

    // Determine if credential is mobile or email
    let user = null;

    if (isValidMobile(credential.trim())) {
      user = await Accounts.getByMobile(credential.trim());
    } else if (isValidEmail(credential.trim())) {
      user = await Accounts.getByEmail(credential.trim());
    } else {
      throw new Error('Enter a valid mobile number or email address.');
    }

    if (!user) throw new Error('No account found with this mobile number or email.');

    // Verify password
    const hashedInput = await hashPassword(password);
    if (hashedInput !== user.password) {
      throw new Error('Incorrect password. Please try again.');
    }

    // Sync guest cart before setting session
    await Cart.syncGuestCartToSupabase(user.id);

    // Set session
    setSession(user);

    return user;
  }

  /* ── Logout ── */

  function logout() {
    clearSession();
    // Clear Supabase cart cache (keep localStorage cleared)
    window.location.href = 'index.html';
  }

  /* ── Update Profile ── */

  async function updateProfile(fields) {
    const session = getSession();
    if (!session) throw new Error('Not logged in.');

    // If updating email, validate and check uniqueness
    if (fields.email && fields.email !== session.email) {
      if (!isValidEmail(fields.email)) throw new Error('Enter a valid email address.');
      const exists = await Accounts.emailExists(fields.email);
      if (exists) throw new Error('This email is already registered.');
    }

    const updated = await Accounts.update(session.id, {
      full_name: fields.full_name?.trim(),
      email:     fields.email?.toLowerCase().trim() || null,
      address:   fields.address?.trim() || null,
    });

    setSession({ ...session, ...updated });
    return updated;
  }

  /* ── Change Password ── */

  async function changePassword(currentPassword, newPassword) {
    const session = getSession();
    if (!session) throw new Error('Not logged in.');
    if (!isValidPassword(newPassword)) throw new Error('New password must be at least 6 characters.');

    // Fetch full user row to verify current password
    const user = await Accounts.getById(session.id);

    // Need password field — fetch separately
    const { data: fullUser } = await db
      .from('accounts')
      .select('password')
      .eq('id', session.id)
      .single();

    const hashedCurrent = await hashPassword(currentPassword);
    if (hashedCurrent !== fullUser.password) {
      throw new Error('Current password is incorrect.');
    }

    const hashedNew = await hashPassword(newPassword);
    await Accounts.update(session.id, { password: hashedNew });
  }

  /* ── Forgot Password: Verify Security Question ── */

  async function verifySecurityAnswer(credential, answer) {
    let user = null;

    if (isValidMobile(credential.trim())) {
      user = await Accounts.getByMobile(credential.trim());
    } else if (isValidEmail(credential.trim())) {
      user = await Accounts.getByEmail(credential.trim());
    }

    if (!user) throw new Error('No account found with this mobile number or email.');

    // Fetch security fields
    const { data: secData } = await db
      .from('accounts')
      .select('security_question, security_answer')
      .eq('id', user.id)
      .single();

    const hashedAnswer = await hashPassword(answer.toLowerCase().trim());
    if (hashedAnswer !== secData.security_answer) {
      throw new Error('Incorrect answer. Please try again.');
    }

    // Return user id so the reset form can proceed
    return { userId: user.id, question: secData.security_question };
  }

  /* ── Forgot Password: Reset After Verification ── */

  async function resetPassword(userId, newPassword) {
    if (!isValidPassword(newPassword)) throw new Error('Password must be at least 6 characters.');
    const hashed = await hashPassword(newPassword);
    await Accounts.update(userId, { password: hashed });
  }

  /* ── Get Security Question (for forgot password step 1) ── */

  async function getSecurityQuestion(credential) {
    let user = null;

    if (isValidMobile(credential.trim())) {
      user = await Accounts.getByMobile(credential.trim());
    } else if (isValidEmail(credential.trim())) {
      user = await Accounts.getByEmail(credential.trim());
    }

    if (!user) throw new Error('No account found with this mobile number or email.');

    const { data } = await db
      .from('accounts')
      .select('security_question')
      .eq('id', user.id)
      .single();

    return { userId: user.id, question: data.security_question };
  }

  /* ── Public API ── */
  return {
    getSession,
    isLoggedIn,
    requireLogin,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    verifySecurityAnswer,
    resetPassword,
    getSecurityQuestion,
  };

})();
