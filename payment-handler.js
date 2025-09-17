const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PaymentHandler {
    constructor(subscriptionManager, userManager) {
        this.subscriptionManager = subscriptionManager;
        this.userManager = userManager;
        this.paymentsFile = path.join(__dirname, 'data', 'payments.json');
        this.paymentNumbersFile = path.join(__dirname, 'data', 'paymentNumbers.json');
        this.verificationCodes = new Map(); // Store verification codes
        this.ensureDataDirectoryExists();
        this.payments = this.loadPayments();
        this.paymentNumbers = this.loadPaymentNumbers();
        
        // Default payment numbers if not set
        if (!this.paymentNumbers.zimbabwe) {
            this.paymentNumbers.zimbabwe = "0777677210";
        }
        if (!this.paymentNumbers.south_africa) {
            this.paymentNumbers.south_africa = "0614159817";
        }
        this.savePaymentNumbers();
        
        // Payment methods
        this.paymentMethods = {
            'ecocash': {
                name: 'EcoCash',
                instructions: `Send to: ${this.paymentNumbers.zimbabwe}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(ecocash|eco)/i,
                domestic: ['zimbabwe']
            },
            'onemoney': {
                name: 'OneMoney',
                instructions: `Send to: ${this.paymentNumbers.zimbabwe}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(one|money)/i,
                domestic: ['zimbabwe']
            },
            'telecash': {
                name: 'Telecash',
                instructions: `Send to: ${this.paymentNumbers.zimbabwe}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(tele|cash)/i,
                domestic: ['zimbabwe']
            },
            'zimswitch': {
                name: 'ZimSwitch',
                instructions: `Use ZimSwitch to: ${this.paymentNumbers.zimbabwe}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(zim|switch)/i,
                domestic: ['zimbabwe']
            },
            'bank_transfer_zw': {
                name: 'Zimbabwe Bank Transfer',
                instructions: `Bank: Your Bank\nAcc: YOUR_ACCOUNT\nRef: YOUR_PHONE_NUMBER\nBeneficiary: ${this.paymentNumbers.zimbabwe}`,
                validation: /^(bank|transfer|zwbank)/i,
                domestic: ['zimbabwe']
            },
            'cash_send_za': {
                name: 'Cash Send (SA)',
                instructions: `Use Cash Send to: ${this.paymentNumbers.south_africa}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(cash|send|sacash)/i,
                domestic: ['south_africa']
            },
            'bank_transfer_za': {
                name: 'South African Bank Transfer',
                instructions: `Bank: Your SA Bank\nAcc: YOUR_ACCOUNT\nRef: YOUR_PHONE_NUMBER\nBeneficiary: ${this.paymentNumbers.south_africa}`,
                validation: /^(bank|transfer|sabank)/i,
                domestic: ['south_africa']
            },
            'mukuru': {
                name: 'Mukuru',
                instructions: `Use Mukuru to send to either:\nZIM: ${this.paymentNumbers.zimbabwe}\nSA: ${this.paymentNumbers.south_africa}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(mukuru)/i,
                international: true
            },
            'worldremit': {
                name: 'WorldRemit',
                instructions: `Use WorldRemit to send to either:\nZIM: ${this.paymentNumbers.zimbabwe}\nSA: ${this.paymentNumbers.south_africa}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(world|remit)/i,
                international: true
            },
            'western_union': {
                name: 'Western Union',
                instructions: `Send via Western Union to either:\nZIM: ${this.paymentNumbers.zimbabwe}\nSA: ${this.paymentNumbers.south_africa}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(western|union)/i,
                international: true
            },
            'moneygram': {
                name: 'MoneyGram',
                instructions: `Send via MoneyGram to either:\nZIM: ${this.paymentNumbers.zimbabwe}\nSA: ${this.paymentNumbers.south_africa}\nReference: YOUR_PHONE_NUMBER`,
                validation: /^(money|gram)/i,
                international: true
            }
        };
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.paymentsFile)) {
            fs.writeFileSync(this.paymentsFile, JSON.stringify({}));
        }
        if (!fs.existsSync(this.paymentNumbersFile)) {
            fs.writeFileSync(this.paymentNumbersFile, JSON.stringify({}));
        }
    }

    loadPayments() {
        try {
            const data = fs.readFileSync(this.paymentsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    loadPaymentNumbers() {
        try {
            const data = fs.readFileSync(this.paymentNumbersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    savePayments() {
        try {
            fs.writeFileSync(this.paymentsFile, JSON.stringify(this.payments, null, 2));
        } catch (error) {
            console.error('Error saving payments:', error);
        }
    }

    savePaymentNumbers() {
        try {
            fs.writeFileSync(this.paymentNumbersFile, JSON.stringify(this.paymentNumbers, null, 2));
        } catch (error) {
            console.error('Error saving payment numbers:', error);
        }
    }

    generateVerificationCode(phoneNumber) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes expiry
        
        this.verificationCodes.set(phoneNumber, {
            code: code,
            expiry: expiry,
            attempts: 0
        });
        
        return code;
    }

    validateVerificationCode(phoneNumber, code) {
        const stored = this.verificationCodes.get(phoneNumber);
        
        if (!stored || stored.expiry < Date.now()) {
            return { valid: false, reason: 'Code expired or not found' };
        }
        
        if (stored.attempts >= 3) {
            return { valid: false, reason: 'Too many attempts' };
        }
        
        stored.attempts++;
        
        if (stored.code === code) {
            this.verificationCodes.delete(phoneNumber);
            return { valid: true };
        }
        
        return { valid: false, reason: 'Invalid code', attemptsLeft: 3 - stored.attempts };
    }

    detectPaymentMethod(text) {
        for (const [key, method] of Object.entries(this.paymentMethods)) {
            if (method.validation.test(text)) {
                return key;
            }
        }
        return null;
    }

    detectSubscriptionPlan(text) {
        const lowerText = text.toLowerCase();
        const plans = this.subscriptionManager.getSubscriptionPlans();
        
        for (const [key, plan] of Object.entries(plans)) {
            if (lowerText.includes(key) || lowerText.includes(plan.name.toLowerCase())) {
                return key;
            }
        }
        return 'weekly'; // Default to weekly
    }

    getSubscriptionPlans(currency = 'USD') {
        return this.subscriptionManager.getSubscriptionPlans(currency);
    }

    extractPaymentDetails(text, phoneNumber) {
        // Extract amount
        const amountMatch = text.match(/\$(\d+\.?\d*)|(\d+\.?\d*)\s*(usd|dollars|dollar)/i) || 
                           text.match(/(\d+\.?\d*)\s*(zwl|rtgs|zimdollars)/i);
        const amount = amountMatch ? parseFloat(amountMatch[1] || amountMatch[2]) : null;
        
        // Extract currency
        let currency = 'USD';
        if (text.match(/zwl|rtgs|zimdollars/i)) {
            currency = 'ZWL';
        }
        
        // Extract reference
        const refMatch = text.match(/ref[:\s]*([a-z0-9]+)|reference[:\s]*([a-z0-9]+)/i);
        const reference = refMatch ? (refMatch[1] || refMatch[2]) : null;
        
        // Extract transaction ID
        const transMatch = text.match(/(trans|transaction)[:\s]*([a-z0-9]+)/i);
        const transactionId = transMatch ? transMatch[2] : null;
        
        return {
            amount: amount,
            currency: currency,
            reference: reference || phoneNumber,
            transactionId: transactionId,
            detectedAmount: amount
        };
    }

    async handleMessage(sock, sender, phoneNumber, username, text, isAdmin = false) {
        try {
            // Check if this is a payment initiation
            if (text.includes('!subscribe') || text.includes('!payment')) {
                return await this.handleSubscriptionRequest(sock, sender, phoneNumber, username, text);
            }
            
            // Check if this is a verification code
            if (text.includes('verify') || text.match(/^\d{6}$/)) {
                return await this.handleVerification(sock, sender, phoneNumber, text);
            }
            
            // Detect payment methods
            const paymentMethod = this.detectPaymentMethod(text);
            if (paymentMethod) {
                return await this.handlePaymentDetection(sock, sender, phoneNumber, username, text, paymentMethod);
            }
            
            // Check for payment confirmation messages
            const paymentKeywords = ['paid', 'sent', 'transfer', 'deposit', 'completed', 'done'];
            const lowerText = text.toLowerCase();
            if (paymentKeywords.some(keyword => lowerText.includes(keyword))) {
                return await this.handlePaymentConfirmation(sock, sender, phoneNumber, username, text);
            }
            
            return false;
            
        } catch (error) {
            console.error('Error handling payment message:', error);
            return false;
        }
    }

    async handleSubscriptionRequest(sock, sender, phoneNumber, username, text) {
        const planKey = this.detectSubscriptionPlan(text);
        const plans = this.getSubscriptionPlans('USD');
        const plan = plans[planKey];
        
        if (plan.demo) {
            // Handle demo subscription
            return await this.handleDemoSubscription(sock, sender, phoneNumber, username);
        }
        
        const verificationCode = this.generateVerificationCode(phoneNumber);
        
        // Get ZWL prices for display
        const zwlPlans = this.getSubscriptionPlans('ZWL');
        const zwlPlan = zwlPlans[planKey];
        
        await sock.sendMessage(sender, {
            text: `📋 *SUBSCRIPTION REQUEST - ${plan.name}*\n\n` +
                  `💰 Price: $${plan.price.toFixed(2)} USD / ZWL${zwlPlan.price.toFixed(2)}\n` +
                  `⏰ Duration: ${plan.duration} days\n` +
                  `🎯 Discount: ${plan.discount}% off\n\n` +
                  `💳 *Payment Methods:*\n` +
                  `• EcoCash/OneMoney: Send to ${this.paymentNumbers.zimbabwe}\n` +
                  `• Zim Banks: Transfer to ${this.paymentNumbers.zimbabwe}\n` +
                  `• SA Cash Send: Send to ${this.paymentNumbers.south_africa}\n` +
                  `• International: Mukuru, WorldRemit, etc.\n\n` +
                  `📝 *Include in your payment:*\n` +
                  `• Reference: ${phoneNumber}\n` +
                  `• Amount: $${plan.price.toFixed(2)} USD or ZWL${zwlPlan.price.toFixed(2)}\n\n` +
                  `🔐 *Verification Code:* ${verificationCode}\n\n` +
                  `📤 After sending payment, reply with:\n` +
                  `"verify ${verificationCode}" to confirm your payment`
        });
        
        return true;
    }

    async handleDemoSubscription(sock, sender, phoneNumber, username) {
        const demoCount = this.subscriptionManager.getDemoUsage(phoneNumber);
        
        if (demoCount >= 2) {
            await sock.sendMessage(sender, {
                text: `❌ You've already used both demo sessions.\n` +
                      `💎 Please subscribe for full access with !subscribe`
            });
            return true;
        }
        
        this.subscriptionManager.activateDemo(phoneNumber);
        
        await sock.sendMessage(sender, {
            text: `🎉 *DEMO ACTIVATED!*\n\n` +
                  `You now have access to:\n` +
                  `• 2 demo downloads\n` +
                  `• Dating profile features\n` +
                  `• Premium content\n\n` +
                  `⏰ Demo expires after 2 uses\n` +
                  `💎 Use !subscribe for full access`
        });
        
        return true;
    }

    async handlePaymentDetection(sock, sender, phoneNumber, username, text, paymentMethod) {
        const method = this.paymentMethods[paymentMethod];
        const planKey = this.detectSubscriptionPlan(text);
        const plans = this.getSubscriptionPlans('USD');
        const plan = plans[planKey];
        
        const verificationCode = this.generateVerificationCode(phoneNumber);
        
        await sock.sendMessage(sender, {
            text: `💳 *${method.name} PAYMENT INSTRUCTIONS*\n\n` +
                  `📋 Plan: ${plan.name} ($${plan.price.toFixed(2)})\n` +
                  `${method.instructions}\n\n` +
                  `📤 After sending, reply with:\n` +
                  `"verify ${verificationCode}"\n\n` +
                  `⏰ Code expires in 15 minutes`
        });
        
        this.recordPaymentAttempt(phoneNumber, {
            method: paymentMethod,
            plan: planKey,
            amount: plan.price,
            currency: 'USD',
            status: 'instructions_sent',
            verificationCode: verificationCode
        });
        
        return true;
    }

    async handleVerification(sock, sender, phoneNumber, text) {
        const codeMatch = text.match(/(?:verify|code)\s*(\d{6})/i) || text.match(/^(\d{6})$/);
        
        if (!codeMatch) {
            await sock.sendMessage(sender, {
                text: `❌ Invalid format. Please use: "verify 123456"`
            });
            return true;
        }
        
        const code = codeMatch[1];
        const validation = this.validateVerificationCode(phoneNumber, code);
        
        if (!validation.valid) {
            await sock.sendMessage(sender, {
                text: `❌ Verification failed: ${validation.reason}\n` +
                      (validation.attemptsLeft ? `Attempts left: ${validation.attemptsLeft}` : '')
            });
            return true;
        }
        
        // Find the payment attempt
        const paymentId = this.findPaymentByVerificationCode(phoneNumber, code);
        if (paymentId) {
            this.payments[paymentId].status = 'verified';
            this.payments[paymentId].verifiedAt = new Date().toISOString();
            this.savePayments();
            
            // Activate subscription
            const plan = this.getSubscriptionPlans()[this.payments[paymentId].plan];
            this.subscriptionManager.activateSubscription(
                phoneNumber, 
                plan.duration, 
                this.payments[paymentId].plan,
                this.payments[paymentId].amount,
                this.payments[paymentId].currency || 'USD'
            );
            
            await sock.sendMessage(sender, {
                text: `✅ *PAYMENT VERIFIED!*\n\n` +
                      `🎉 Your ${plan.name} subscription is now active!\n` +
                      `⏰ Expires: ${this.formatDate(new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000))}\n\n` +
                      `✨ You now have access to:\n` +
                      `• Unlimited downloads\n` +
                      `• Dating profile features\n` +
                      `• Premium content\n` +
                      `• Priority support\n\n` +
                      `💝 Use !dating to set up your profile!`
            });
        } else {
            await sock.sendMessage(sender, {
                text: `❌ No pending payment found for this code`
            });
        }
        
        return true;
    }

    async handlePaymentConfirmation(sock, sender, phoneNumber, username, text) {
        const details = this.extractPaymentDetails(text, phoneNumber);
        const planKey = this.detectSubscriptionPlan(text);
        const plans = this.getSubscriptionPlans('USD');
        const plan = plans[planKey];
        
        const verificationCode = this.generateVerificationCode(phoneNumber);
        
        this.recordPaymentAttempt(phoneNumber, {
            method: 'detected',
            plan: planKey,
            amount: details.amount || plan.price,
            currency: details.currency || 'USD',
            reference: details.reference,
            transactionId: details.transactionId,
            status: 'pending_verification',
            verificationCode: verificationCode
        });
        
        await sock.sendMessage(sender, {
            text: `📋 *PAYMENT RECEIVED*\n\n` +
                  `We've noted your payment of ${details.currency === 'ZWL' ? 'ZWL' : '$'}${details.amount || plan.price}\n` +
                  `Reference: ${details.reference}\n` +
                  `Transaction: ${details.transactionId || 'Not provided'}\n\n` +
                  `🔐 *Verification Required:*\n` +
                  `Please reply with: "verify ${verificationCode}"\n\n` +
                  `⏰ Code expires in 15 minutes`
        });
        
        return true;
    }

    recordPaymentAttempt(phoneNumber, details) {
        const paymentId = `pay_${Date.now()}_${phoneNumber}`;
        
        this.payments[paymentId] = {
            phoneNumber: phoneNumber,
            ...details,
            timestamp: new Date().toISOString(),
            verified: false
        };
        
        this.savePayments();
        return paymentId;
    }

    findPaymentByVerificationCode(phoneNumber, code) {
        return Object.keys(this.payments).find(id => 
            this.payments[id].phoneNumber === phoneNumber &&
            this.payments[id].verificationCode === code &&
            this.payments[id].status === 'pending_verification'
        );
    }

    formatDate(date) {
        return date.toLocaleDateString('en-ZA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    async activateSubscription(sock, adminSender, targetPhone, planKey = 'monthly') {
        try {
            const cleanPhone = targetPhone.replace(/\D/g, '');
            const plans = this.getSubscriptionPlans('USD');
            const plan = plans[planKey];
            
            this.subscriptionManager.activateSubscription(cleanPhone, plan.duration, planKey, plan.price, 'USD');
            
            await sock.sendMessage(adminSender, {
                text: `✅ ${plan.name} subscription activated for ${cleanPhone}\n` +
                      `⏰ Expires: ${this.formatDate(new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000))}`
            });
            
            // Try to notify user
            try {
                await sock.sendMessage(`${cleanPhone}@s.whatsapp.net`, {
                    text: `🎉 *ADMIN ACTIVATED SUBSCRIPTION!*\n\n` +
                          `Your ${plan.name} subscription is now active!\n` +
                          `⏰ Expires: ${this.formatDate(new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000))}\n\n` +
                          `✨ You now have access to:\n` +
                          `• Unlimited downloads\n` +
                          `• Dating profile features\n` +
                          `• Premium content\n\n` +
                          `💝 Use !dating to set up your profile!`
                });
            } catch (userError) {
                console.log(`Could not notify user ${cleanPhone}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error activating subscription:', error);
            await sock.sendMessage(adminSender, {
                text: `❌ Error: ${error.message}`
            });
            return false;
        }
    }

    getPaymentStats() {
        const allPayments = Object.values(this.payments);
        const completed = allPayments.filter(p => p.verified);
        
        let revenue = 0;
        completed.forEach(payment => {
            revenue += payment.amount || 0;
        });
        
        return {
            total: allPayments.length,
            pending: allPayments.filter(p => !p.verified).length,
            completed: completed.length,
            revenue: revenue
        };
    }
}

module.exports = PaymentHandler;