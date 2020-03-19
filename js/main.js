var historyInterval
var predictionInterval
var timeout = 500;
var totalPeople = 0
var peopleScale = 500000

function percent(part, whole) {
    if (whole == null || whole === undefined || whole == 0)
        return '0%'
    return (part / whole * 100).toFixed(1) + '%';
}

function change(a, b) {
    let n = b - a
    return (n < 0 ? "" : "+") + n
}

function getHealthyCount(countryName, current) {
    let healhyCount = Math.max(population[countryName] - current.confirmed - current.deaths - current.recovered, 0)
    return healhyCount;
}

function displayHealthy(countryName, current) {
    let healhyCount = getHealthyCount(countryName, current);
    $('#healthy-count-span').html(healhyCount.toLocaleString())
    drawPeople(healhyCount, 'healthy', countryName)
}

function start(countryName) {
    console.log(`starting ${countryName}`)
    let countries = getCountries()
    let countryData = countries[countryName]

    $('#error-message').html(``)
    if (!population[countryName]) {
        $('#error-message').html(`Sorry, no population data exists for ${countryName}`)
        return
    }

    $('#population').html(population[countryName].toLocaleString())

    let i = 0
    let growthRateSum = 0.0
    let growthRateCount = 0
    let recoveryRateSum = 0.0
    let recoveryRateCount = 0
    let deathRateSum = 0.0
    let deathRateCount = 0
    let date = new Date()
    historyInterval = window.setInterval(() => {

        if (i >= countryData.length) {
            clearInterval(historyInterval)
            return
        }

        let current = countryData[i];
        $('#people-div').html('')
        totalPeople = 0

        //set date
        date = new Date(current.date);
        $('#date').html(date.toDateString())

        //infected
        let infectedCount = current.confirmed - current.recovered - current.deaths
        $('#infected-count-span').html(infectedCount.toLocaleString())
        let yesterdayInfectedCount = 0
        if (i > 0) {
            yesterdayInfectedCount = countryData[i - 1].confirmed - countryData[i - 1].recovered - countryData[i - 1].deaths
            if (yesterdayInfectedCount > 0) {
                growthRateSum += (infectedCount - yesterdayInfectedCount) / yesterdayInfectedCount
                growthRateCount++
            }
            $('#growth-rate-span').html(`(${change(yesterdayInfectedCount, infectedCount)} ~ ${percent(infectedCount - yesterdayInfectedCount, yesterdayInfectedCount)})`)
        }

        //recovered
        $('#recovered-count-span').html(current.recovered.toLocaleString())
        $('#recovered-rate-span').html(`(${percent(current.recovered, (current.deaths + current.recovered))})`)
        if (yesterdayInfectedCount > 0 && (current.recovered > 0 || recoveryRateSum > 0)) {
            let yesterday = i - 1
            recoveryRateSum += (current.recovered - countryData[yesterday].recovered) / yesterdayInfectedCount
            recoveryRateCount++
        }

        //dead
        let deadCount = current.deaths
        $('#dead-count-span').html(deadCount.toLocaleString())
        $('#mortality-rate-span').html(`(${percent(deadCount, (deadCount + current.recovered))})`)
        if (yesterdayInfectedCount > 0 && (current.deaths > 0 || deathRateSum > 0)) {
            let yesterday = i - 1
            deathRateSum += (current.deaths - countryData[yesterday].deaths) / yesterdayInfectedCount
            deathRateCount++
        }

        drawPeople(deadCount, 'dead', countryName)
        drawPeople(infectedCount, 'infected', countryName)
        drawPeople(current.recovered, 'recovered', countryName)
        displayHealthy(countryName, current, countryName);

        i++
    }, timeout)

    let current = countryData[countryData.length - 1]
    let minNewRecovered = 0
    predictionInterval = window.setInterval(() => {
        if (i < countryData.length || (current.deaths + current.recovered) >= population[countryName] || recoveryRateCount == 0 || deathRateCount == 0 || growthRateCount == 0) return

        console.log(`current:`, current)
        console.log(`date: `, date)
        date.setDate(date.getDate() + 1)
        $('#date').html(date.toDateString())
        $('#people-div').html('')
        totalPeople = 0

        let yesterDayInfected = current.confirmed - current.deaths - current.recovered
        if (current.confirmed >= population[countryName] && minNewRecovered == 0) {
            minNewRecovered = Math.round(yesterDayInfected / 16 + 0.5)
        }

        let avgGrowthRate = growthRateSum / growthRateCount
        let avgRecoveryRate = recoveryRateSum / recoveryRateCount
        let avgDeathRate = avgRecoveryRate * 0.047

        let newDeaths = Math.round(yesterDayInfected * avgDeathRate);
        let newRecovered = Math.max(Math.round(yesterDayInfected * avgRecoveryRate), Math.min(minNewRecovered, yesterDayInfected * (1 - avgDeathRate)));
        let newInfected = Math.round(yesterDayInfected * avgGrowthRate);

        current.deaths = current.deaths + newDeaths
        current.recovered = current.recovered + newRecovered
        current.confirmed = Math.min(current.confirmed + newInfected + newDeaths + newRecovered, population[countryName])
        current.infected = current.confirmed - current.recovered - current.deaths

        $('#people-div').html('')
        $('#infected-count-span').html(current.infected.toLocaleString())
        $('#growth-rate-span').html(`(${change(0, newInfected)} ~ ${percent(growthRateSum, growthRateCount)})`)
        $('#recovered-count-span').html(current.recovered.toLocaleString())
        $('#recovered-rate-span').html(`(${percent(current.recovered, (current.deaths + current.recovered))})`)
        let deadCount = current.deaths
        $('#dead-count-span').html(deadCount.toLocaleString())
        $('#mortality-rate-span').html(`(${percent(deadCount, (deadCount + current.recovered))})`)

        drawPeople(deadCount, 'dead', countryName)
        drawPeople(current.infected, 'infected', countryName)
        drawPeople(current.recovered, 'recovered', countryName)
        displayHealthy(countryName, current, countryName)

        console.log(`totalPeople: ${(totalPeople * peopleScale).toLocaleString()}; currentTotal: ${(current.confirmed + getHealthyCount(countryName, current)).toLocaleString()}; population: ${population[countryName].toLocaleString()}`)

        i++
    }, timeout)

}

$(document).ready(function () {
    console.log("ready!")
    refreshCountries()
})

function getCountries() {
    return JSON.parse(localStorage.getItem(new Date().toLocaleDateString()))
}

function refreshCountries() {
    let countries = getCountries()
    if (countries) {
        displayCountries(countries)
        return
    }
    localStorage.clear()
    $.getJSON("https://pomber.github.io/covid19/timeseries.json", function (data) {
        displayCountries(data);

        localStorage.setItem(new Date().toLocaleDateString(), JSON.stringify(data))
        countriesLoaded = true
    });
}

function displayCountries(data) {
    let countryNames = []

    $.each(data, function (key, val) {
        countryNames.push(key)
    })
    countryNames.sort()
    countryNames.forEach(country => {
        if (population[country])
            $('#country-select').append("<option id='" + country + "'>" + country + "</option>")
        else
            $('#country-select').append("<option id='" + country + "' class='no-population'>" + country + "</option>")
    })
}

$('#country-select').change(() => {
    let counrtySelected = $("#country-select option:selected").val();

    if (historyInterval)
        clearInterval(historyInterval)

    start(counrtySelected)
})

function drawPeople(count, type, countryName) {

    $('#scale-span').html(peopleScale.toLocaleString())
    $('#scale-div').show()

    let people = Math.round(count / peopleScale)
    for (let i = 0; i < people; i++) {
        $('#people-div').append(`<i class="fas fa-male ${type} fa-2x"></i>`)
        totalPeople++
    }

    if (type == 'healthy')
        $('#scale-span').append(` - ${(totalPeople * peopleScale).toLocaleString()}`)

}