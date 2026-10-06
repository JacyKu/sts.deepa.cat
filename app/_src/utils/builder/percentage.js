class Percentage {
    constructor(value, percent) {
        if (this.isPercent(percent)) {
            this.perc = Number(value);
            this.val = Number(value) / 100;
        } else {
            this.perc = Number(value) * 100;
            this.val = Number(value);
        }
    }

    isPercent(percent) {
        // The default should be a percentage.
        // So, if percent is true or not specified at all (not passed into the constructor)
        // the value should be treated as a percentage.
        return percent == true || percent == undefined;
    }

    toFixedPerc(places) {
        return this.perc.toFixed(places);
    }

    addP(percentage) {
        this.perc = Number((this.perc + percentage.perc).toFixed(2));
        this.val = Number((this.val + percentage.val).toFixed(2));
        return this;
    }

    mulP(percentage) {
        this.perc = Number((this.perc * percentage.val).toFixed(2));
        this.val = Number((this.val * percentage.val).toFixed(2));
        return this;
    }

    add(value, percent) {
        if (this.isPercent(percent)) {
            this.perc = Number((this.perc + Number(value)).toFixed(2));
            // Re-Fix the value in order to fix potential precision errors.
            // Happened for example equipping poet's tome and auric tiara, has weird calculations for HP.
            this.val = Number((this.val + Number(value) / 100).toFixed(2));
        } else {
            this.perc = Number((this.perc + Number(value) * 100).toFixed(2));
            // Same as above.
            this.val = Number((this.val + Number(value)).toFixed(2));
        }
        return this;
    }

    mul(value, percent) {
        if (this.isPercent(percent)) {
            this.perc = Number((this.perc * (Number(value) / 100)).toFixed(2));
            this.val = Number((this.val * (Number(value) / 100)).toFixed(2));
        } else {
            this.perc = Number((this.perc * Number(value)).toFixed(2));
            this.val = Number((this.val * Number(value)).toFixed(2));
        }
        return this;
    }

    preciseMul(value, percent) {
        if (this.isPercent(percent)) {
            this.perc = Number((this.perc * (Number(value) / 100)).toFixed(4));
            this.val = Number((this.val * (Number(value) / 100)).toFixed(4));
        } else {
            this.perc = Number((this.perc * Number(value)).toFixed(4));
            this.val = Number((this.val * Number(value)).toFixed(4));
        }
        return this;
    }

    duplicate() {
        return new Percentage(this.perc);
    }
}

export default Percentage;
