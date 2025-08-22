const fs = require('fs');
const path = require('path');

class PaymentHandler {
    constructor(subscriptionManager, userManager) {
        this.subscriptionManager = subscriptionManager;
        this.userManager = userManager;
        this.paymentsFile = path.join(__dirname, 'data', 'payments.json');
        this.ensureDataDirectoryExists();
        this.payments = this.loadPayments();
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.paymentsFile)) {
            fs.writeFileSync(this.paymentsFile, JSON.stringify({}));
        }
    }

    loadPayments() {
        try {
            const data = fs.readFileSync(this.paymentsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading payments:', error);
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

    async handlePaymentMessage(sock, sender, phoneNumber, username, message) {
        try {
            // Check if message contains payment-related keywords
            const text = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || '';
            
            const lowerText = text.toLowerCase();
            
            // Detect payment messages
            if (lowerText.includes('paid') || 
                lowerText.includes('sent') || 
                lowerText.includes('ecocash') || 
                lowerText.includes('send') ||
                lowerText.includes('payment') ||
                lowerText.includes('$')) {
                
                console.log(`💰 Payment detected from ${username}: ${text}`);
                
                // Set payment as pending
                this.subscriptionManager.setPaymentPending(phoneNumber);
                
                // Record payment attempt
                this.recordPaymentAttempt(phoneNumber, text);
                
                // Send confirmation message
                await sock.sendMessage(sender, {
                    text: `✅ Thank you ${username}! Your payment has been noted and is being verified. Our admin will activate your subscription shortly. Please wait for confirmation.`
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error handling payment message:', error);
            return false;
        }
    }

    recordPaymentAttempt(phoneNumber, message) {
        const paymentId = `payment_${Date.now()}_${phoneNumber}`;
        
        this.payments[paymentId] = {
            phoneNumber: phoneNumber,
            message: message,
            timestamp: new Date().toISOString(),
            status: 'pending',
            verified: false
        };
        
        this.savePayments();
        
        console.log(`📝 Recorded payment attempt from ${phoneNumber}`);
    }

    async activateSubscription(sock, adminSender, targetPhone) {
        try {
            // Remove any non-digit characters
            const cleanPhone = targetPhone.replace(/\D/g, '');
            
            // Activate subscription
            this.subscriptionManager.activateSubscription(cleanPhone);
            
            // Send confirmation to admin
            await sock.sendMessage(adminSender, {
                text: `✅ Subscription activated for ${cleanPhone}`
            });
            
            // Try to send confirmation to user if they're in contacts
            const userJid = `${cleanPhone}@s.whatsapp.net`;
            try {
                await sock.sendMessage(userJid, {
                    text: `🎉 Your subscription has been activated! You now have unlimited downloads for 2 weeks. Enjoy!`
                });
            } catch (userError) {
                console.log(`Could not send confirmation to ${cleanPhone}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error activating subscription:', error);
            await sock.sendMessage(adminSender, {
                text: `❌ Error activating subscription: ${error.message}`
            });
            return false;
        }
    }

    getPendingPayments() {
        return Object.values(this.payments).filter(payment => 
            payment.status === 'pending' && !payment.verified
        );
    }

    markPaymentVerified(paymentId) {
        if (this.payments[paymentId]) {
            this.payments[paymentId].verified = true;
            this.payments[paymentId].verifiedAt = new Date().toISOString();
            this.savePayments();
            return true;
        }
        return false;
    }

    markPaymentCompleted(paymentId) {
        if (this.payments[paymentId]) {
            this.payments[paymentId].status = 'completed';
            this.payments[paymentId].completedAt = new Date().toISOString();
            this.savePayments();
            return true;
        }
        return false;
    }

    getPaymentStats() {
        const allPayments = Object.values(this.payments);
        const pending = allPayments.filter(p => p.status === 'pending').length;
        const completed = allPayments.filter(p => p.status === 'completed').length;
        
        return {
            total: allPayments.length,
            pending: pending,
            completed: completed,
            revenue: completed * 2 // Assuming $2 per subscription
        };
    }
}

module.exports = PaymentHandler;
